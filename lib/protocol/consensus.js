/*!
 * consensus.js - consensus constants and helpers for bcoin
 * Copyright (c) 2014-2015, Fedor Indutny (MIT License)
 * Copyright (c) 2014-2017, Christopher Jeffrey (MIT License).
 * https://github.com/bcoin-org/bcoin
 */

'use strict';

/**
 * @module protocol/consensus
 */

var assert = require('assert');
var BN = require('bn.js');

/**
 * One bitcoin in satoshis.
 * @const {Amount}
 * @default
 */

exports.COIN = 100000000;

/**
 * Maximum amount of money in satoshis:
 * `21million * 1btc` (consensus).
 * @const {Amount}
 * @default
 */

exports.MAX_MONEY = 21000000 * exports.COIN;

/**
 * Base block subsidy (consensus).
 * Note to shitcoin implementors: if you
 * increase this to anything greater than
 * 33 bits, getReward will have to be
 * modified to handle the shifts.
 * @const {Amount}
 * @default
 */

exports.BASE_REWARD = 50 * exports.COIN;

/**
 * Half base block subsidy. Required to
 * calculate the reward properly (with
 * only 32 bit shifts available).
 * @const {Amount}
 * @default
 */

exports.HALF_REWARD = Math.floor(exports.BASE_REWARD / 2);

/**
 * Maximum block size (consensus).
 * @const {Number}
 * @default
 */

exports.MAX_BLOCK_SIZE = 1000000;

/**
 * Maximum block sigops (consensus).
 * @const {Number}
 * @default
 */

exports.MAX_BLOCK_SIGOPS = 1000000 / 50;

/**
 * Maximum extension block size (consensus).
 * @const {Number}
 * @default
 */

exports.MAX_EXTENSION_SIZE = 6000000;

/**
 * Maximum extension inputs and outputs cost (consensus).
 * @const {Number}
 * @default
 */

exports.MAX_EXTENSION_COST = 9600000;

/**
 * Maximum extension sigops cost (consensus).
 * @const {Number}
 * @default
 */

exports.MAX_EXTENSION_SIGOPS_COST = 320000;

/**
 * What bits to set in version
 * for versionbits blocks.
 * @const {Number}
 * @default
 */

exports.VERSION_TOP_BITS = 0x20000000;

/**
 * What bitmask determines whether
 * versionbits is in use.
 * @const {Number}
 * @default
 */

exports.VERSION_TOP_MASK = 0xe0000000;

/**
 * Number of blocks before a coinbase
 * spend can occur (consensus).
 * @const {Number}
 * @default
 */

exports.COINBASE_MATURITY = 100;

/**
 * Amount to multiply witness programs cost by.
 * @const {Number}
 * @default
 */

exports.WITNESS_V0_FACTOR = 8;

/**
 * nLockTime threshold for differentiating
 * between height and time (consensus).
 * Tue Nov 5 00:53:20 1985 UTC
 * @const {Number}
 * @default
 */

exports.LOCKTIME_THRESHOLD = 500000000;

/**
 * Highest nSequence bit -- disables
 * sequence locktimes (consensus).
 * @const {Number}
 */

exports.SEQUENCE_DISABLE_FLAG = (1 << 31) >>> 0;

/**
 * Sequence time: height or time (consensus).
 * @const {Number}
 * @default
 */

exports.SEQUENCE_TYPE_FLAG = 1 << 22;

/**
 * Sequence granularity for time (consensus).
 * @const {Number}
 * @default
 */

exports.SEQUENCE_GRANULARITY = 9;

/**
 * Sequence mask (consensus).
 * @const {Number}
 * @default
 */

exports.SEQUENCE_MASK = 0x0000ffff;

/**
 * Max serialized script size (consensus).
 * @const {Number}
 * @default
 */

exports.MAX_SCRIPT_SIZE = 10000;

/**
 * Max stack size during execution (consensus).
 * @const {Number}
 * @default
 */

exports.MAX_SCRIPT_STACK = 1000;

/**
 * Max script element size (consensus).
 * @const {Number}
 * @default
 */

exports.MAX_SCRIPT_PUSH = 520;

/**
 * Max opcodes executed (consensus).
 * @const {Number}
 * @default
 */

exports.MAX_SCRIPT_OPS = 201;

/**
 * Max `n` value for multisig (consensus).
 * @const {Number}
 * @default
 */

exports.MAX_MULTISIG_PUBKEYS = 20;

/**
 * The date bip16 (p2sh) was activated (consensus).
 * @const {Number}
 * @default
 */

exports.BIP16_TIME = 1333238400;

/**
 * Convert a compact number to a big number.
 * Used for `block.bits` -> `target` conversion.
 * @param {Number} compact
 * @returns {BN}
 */

exports.fromCompact = function fromCompact(compact) {
  var exponent = compact >>> 24;
  var negative = (compact >>> 23) & 1;
  var mantissa = compact & 0x7fffff;
  var num;

  if (compact === 0)
    return new BN(0);

  if (exponent <= 3) {
    mantissa >>>= 8 * (3 - exponent);
    num = new BN(mantissa);
  } else {
    num = new BN(mantissa);
    num.iushln(8 * (exponent - 3));
  }

  if (negative)
    num.ineg();

  return num;
};

/**
 * Convert a big number to a compact number.
 * Used for `target` -> `block.bits` conversion.
 * @param {BN} num
 * @returns {Number}
 */

exports.toCompact = function toCompact(num) {
  var mantissa, exponent, compact;

  if (num.cmpn(0) === 0)
    return 0;

  exponent = num.byteLength();

  if (exponent <= 3) {
    mantissa = num.toNumber();
    mantissa <<= 8 * (3 - exponent);
  } else {
    mantissa = num.ushrn(8 * (exponent - 3)).toNumber();
  }

  if (mantissa & 0x800000) {
    mantissa >>= 8;
    exponent++;
  }

  compact = (exponent << 24) | mantissa;

  if (num.isNeg())
    compact |= 0x800000;

  compact >>>= 0;

  return compact;
};

/**
 * Verify proof-of-work.
 * @param {Hash} hash
 * @param {Number} bits
 * @returns {Boolean}
 */

exports.verifyPOW = function verifyPOW(hash, bits) {
  var target = exports.fromCompact(bits);

  if (target.isNeg() || target.cmpn(0) === 0)
    return false;

  hash = new BN(hash, 'le');

  if (hash.cmp(target) > 0)
    return false;

  return true;
};

/**
 * Calculate block subsidy.
 * @param {Number} height - Reward era by height.
 * @returns {Amount}
 */

exports.getReward = function getReward(height, interval) {
  var halvings = Math.floor(height / interval);

  assert(height >= 0, 'Bad height for reward.');

  // BIP 42 (well, our own version of it,
  // since we can only handle 32 bit shifts).
  // https://github.com/bitcoin/bips/blob/master/bip-0042.mediawiki
  if (halvings >= 33)
    return 0;

  // We need to shift right by `halvings`,
  // but 50 btc is a 33 bit number, so we
  // cheat. We only start halving once the
  // halvings are at least 1.
  if (halvings === 0)
    return exports.BASE_REWARD;

  return exports.HALF_REWARD >>> (halvings - 1);
};
