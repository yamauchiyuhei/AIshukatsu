// Canonical implementation now lives in src/lib/textMatch.ts so the workspace
// document search, the company combobox, and this hidden-route search all share
// one normalizer. Re-exported here to keep existing import paths working.
export { normalize, matchRank } from '../../lib/textMatch';
