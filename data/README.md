# data/

Dataset sources for SignBridge. No dataset files are committed or downloaded yet; this file records where the data comes from and under what terms it is used.

## Sources

- **WLASL** (Word-level American Sign Language): word-level ASL video dataset used to train the Direction A temporal model. Research use; check the project page for the current license terms before downloading.
- **MS-ASL**: large-scale ASL video dataset, another training source for the temporal model. Research use; verify license terms on the project page before downloading.
- **SignBank** (SignBank of ASL / ASL SignBank): dictionary source for avatar sign entries in Direction B. Verify the license for the entries used before bundling any of them.

## Rules

- Download datasets manually when the training step starts; they must not be committed to this repository.
- Record exact versions / subsets used and their license terms here once confirmed (days 1 to 2 task).
- The coffee shop domain uses roughly 150 signs: ordering, size, allergy, price, thanks.
