// SignBridge avatar: Three.js rig placeholder for Direction B (Voice to Sign).
// A rigged avatar performs dictionary signs with motion interpolation and
// facial grammar. Generative video is not used for hand articulation.

// TODO: add Three.js dependency and load a rigged avatar model (glTF with
// named hand / arm / face bones). Muse Image is only for avatar appearance
// and branding, not for sign performance.

/**
 * Create an avatar rig bound to a canvas.
 *
 * @param {HTMLCanvasElement} canvas render target
 * @returns {Promise<AvatarRig>} the rig handle
 */
export async function createAvatarRig(canvas) {
  // TODO: implement. Init renderer / scene / camera, load glTF avatar,
  // resolve bone references for hands, arms, and facial grammar markers.
  throw new Error("createAvatarRig: not implemented (stub)");
}

/**
 * @typedef {Object} AvatarRig
 * @property {(glossSequence: string[]) => Promise<void>} performSequences
 *   plays a sequence of sign entries from the dictionary loader, with
 *   tweening between them and facial grammar markers
 * @property {() => void} stop
 */

/**
 * TODO: connect the gloss planner. Input is an ASL gloss sequence from
 * Muse Spark (see ../api/muse.js and englishToGloss), output is timing
 * and keyframes fed to performSequences.
 */
export async function planAndPerform(rig, glossSequence) {
  // TODO: implement.
  throw new Error("planAndPerform: not implemented (stub)");
}
