// import { randomBytes } from 'crypto'; nacl replaces crypto
import * as nacl from '../nacl/naclWrappers';
//import { bufToBinary, computeChecksum, padding, pbkdf2, toUtf8 } from "./helper";
import { computeChecksum, toUint11Array, toUint8Array } from './helper';
import * as address from '../encoding/address';
import { language } from "./mnemonic";
import Account from '../types/account';

export const FAIL_TO_DECODE_MNEMONIC_ERROR_MSG = 'failed to decode mnemonic';
export const NOT_IN_WORDS_LIST_ERROR_MSG =
  'the mnemonic contains a word that is not in the wordlist';

export function applyWords(nums: number[]) {
  return nums.map((n) => language.english[n]);
}
/**
 * mnemonicFromSeed converts a 32-byte key into a 25 word mnemonic. The generated mnemonic includes a checksum.
 * Each word in the mnemonic represents 11 bits of data, and the last 11 bits are reserved for the checksum.
 * @param seed - 32 bytes long seed
 * @returns 25 words mnemonic
 */
export function mnemonicFromSeed(seed: Uint8Array) {
  // Sanity length check
  if (seed.length !== nacl.SEED_BTYES_LENGTH) {
    throw new RangeError(`Seed length must be ${nacl.SEED_BTYES_LENGTH}`);
  }

  const uint11Array = toUint11Array(seed);
  const words = applyWords(uint11Array);
  const checksumWord = computeChecksum(seed);

  return `${words.join(' ')} ${checksumWord}`;
}

/**
 * seedFromMnemonic converts a mnemonic generated using this library into the source key used to create it.
 * It returns an error if the passed mnemonic has an incorrect checksum, if the number of words is unexpected, or if one
 * of the passed words is not found in the words list.
 * @param mnemonic - 25 words mnemonic
 * @returns 32 bytes long seed
 */
export function seedFromMnemonic(mnemonic: string) {
  const words = mnemonic.split(' ');
  const key = words.slice(0, 24);

  // Check that all words are in list
  for (const w of key) {
    if (language.english.indexOf(w) === -1) throw new Error(NOT_IN_WORDS_LIST_ERROR_MSG);
  }

  const checksum = words[words.length - 1];
  const uint11Array = key.map((word) => language.english.indexOf(word));

  // Convert the key to uint8Array
  let uint8Array = toUint8Array(uint11Array);

  // We need to chop the last byte -
  // the short explanation - Since 256 is not divisible by 11, we have an extra 0x0 byte.
  // The longer explanation - When splitting the 256 bits to chunks of 11, we get 23 words and a left over of 3 bits.
  // This left gets padded with another 8 bits to the create the 24th word.
  // While converting back to byte array, our new 264 bits array is divisible by 8 but the last byte is just the padding.

  // check that we have 33 bytes long array as expected
  if (uint8Array.length !== 33)
    throw new Error(FAIL_TO_DECODE_MNEMONIC_ERROR_MSG);

  // check that the last byte is actually 0x0
  if (uint8Array[uint8Array.length - 1] !== 0x0)
    throw new Error(FAIL_TO_DECODE_MNEMONIC_ERROR_MSG);

  // chop it !
  uint8Array = uint8Array.slice(0, uint8Array.length - 1);

  // compute checksum
  const cs = computeChecksum(uint8Array);

  // success!
  if (cs === checksum) return uint8Array;

  throw new Error(FAIL_TO_DECODE_MNEMONIC_ERROR_MSG);
}

/**
 * mnemonicToSecretKey takes a mnemonic string and returns the corresponding Algorand address and its secret key.
 * @param mn - 25 words Algorand mnemonic
 * @throws error if fails to decode the mnemonic
 */
export function mnemonicToSecretKey(mn: string): Account {
  const seed = seedFromMnemonic(mn);
  const keys = nacl.keyPairFromSeed(seed);
  const encodedPk = address.encodeAddress(keys.publicKey);
  return { addr: encodedPk, sk: keys.secretKey };
}

/**
 * secretKeyToMnemonic takes an Algorand secret key and returns the corresponding mnemonic.
 * @param sk - Algorand secret key
 * @returns Secret key's associated mnemonic
 */
export function secretKeyToMnemonic(sk: Uint8Array) {
  // get the seed from the sk
  const seed = sk.slice(0, nacl.SEED_BTYES_LENGTH);
  return mnemonicFromSeed(seed);
}

/**
 * mnemonicToMasterDerivationKey takes a mnemonic string and returns the corresponding master derivation key.
 * @param mn - 25 words Algorand mnemonic
 * @returns Uint8Array
 * @throws error if fails to decode the mnemonic
 */
export function mnemonicToMasterDerivationKey(mn: string) {
  return seedFromMnemonic(mn);
}

/**
 * masterDerivationKeyToMnemonic takes a master derivation key and returns the corresponding mnemonic.
 * @param mdk - Uint8Array
 * @returns string mnemonic
 */
export function masterDerivationKeyToMnemonic(mdk: Uint8Array) {
  return mnemonicFromSeed(mdk);
}
