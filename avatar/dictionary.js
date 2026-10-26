// SignBridge sign dictionary loader stub.
// Dictionary data comes from SignBank (see ../data/README.md for sources and
// licenses). No dataset files are committed to this repository.

/**
 * @typedef {Object} SignEntry
 * @property {string} gloss ASL gloss label, for example "PIZZA"
 * @property {Array<Object>} keyframes ordered keyframes for the avatar rig
 * @property {Array<Object>} [facialGrammar] eyebrow / mouth markers
 * @property {string} [source] attribution to the dataset entry
 */

/**
 * Load the sign dictionary for a domain.
 *
 * @param {string} domain currently only "coffee-shop" is in scope (~150 signs)
 * @returns {Promise<Map<string, SignEntry>>} gloss to entry map
 */
export async function loadSignDictionary(domain = "coffee-shop") {
  // TODO: implement. Fetch or bundle the curated subset of SignBank entries
  // for the domain. Validate keyframe schema before handing to the rig.
  throw new Error("loadSignDictionary: not implemented (stub)");
}
