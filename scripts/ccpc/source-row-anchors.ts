// Immutable sourceRows digests independently reconstructed from the six original ZIPs.
import { CivicParticipationError, participationKey } from '../../src/domain/civic/participation.ts';
import type { ParticipationDataset } from '../../src/domain/civic/participation.ts';
import { canonicalJson, sha256 } from './etl-io.ts';

export const FULL_SOURCE_ROWS_SHA256: Record<number,string> = {
  "2009": "ed774e35b5f947c38fe760c56a2cf5b4a4d6f0b0f09d98c09f220fbb63438c75",
  "2012": "a911fb2b09bd897f9c121fd02fbea27cd1d288f026b9efc6fd1c0ffa434b9813",
  "2015": "5806eec491bcaec9e76f7b49a7b57ad0fb52d02936183583e96cccfded9e4f76",
  "2018": "09973686a3563098d07addd0bb34f1cba09dee9ce79239b7bf651cba0544b058",
  "2021": "1c61dee7ff2e4e34dd89c7435e910dc77c8872e10a01e07d52b3b17c70852bf6",
  "2024": "c7e8d08f1bed99dad323960dc0c8199ee8e22bc3cdbe16f0dabb522fae3e0858"
};
export const SAMPLE_SOURCE_ROWS_SHA256 = '7c6127353b898e44a3ac80326e71a904017d79b46932a3dc595bc651ae9f503d';

export function verifySourceRowDigest(dataset: ParticipationDataset): void {
  const hashRows = (records: ParticipationDataset['records']) => sha256(canonicalJson(records
    .map(row => ({ key:participationKey(row), sourceRows:row.sourceRows }))
    .sort((a,b) => a.key < b.key ? -1 : a.key > b.key ? 1 : 0)));
  if (dataset.kind === 'sample') {
    if (hashRows(dataset.records) !== SAMPLE_SOURCE_ROWS_SHA256) {
      throw new CivicParticipationError('SOURCE_ROWS_REFERENCE_MISMATCH','Las filas originales por grupo no coinciden con el fixture reconstruido desde los ZIP.');
    }
  } else {
    for (const year of dataset.years) {
      if (hashRows(dataset.records.filter(row => row.year === year)) !== FULL_SOURCE_ROWS_SHA256[year]) {
        throw new CivicParticipationError('SOURCE_ROWS_REFERENCE_MISMATCH',`Las filas originales por grupo no coinciden con el ZIP ${year}.`);
      }
    }
  }
}
