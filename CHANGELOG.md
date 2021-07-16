# veres-one-validator ChangeLog

### 8.0.0 - TBD

### Changed
- **BREAKING**: Validators no longer accept `capabilitionAction` `create` or `update` just `write`.
- **BREAKING**: Validators for proofs require `invocationTarget` is set.

## 7.0.0 - 2020-09-30

### Changed
- **BREAKING**: Use jsonld-signatures@6 that has breaking changes in error
  return signature in the validate API.

## 6.0.0 - 2020-02-20

### Added
- **BREAKING**: Update electorPool schema to latest version.
- **BREAKING**: Update service schema to match latest spec.
- **BREAKING**: Add schema for web ledger configuration.
- **BREAKING**: Update to latest ledger APIs.
- **BREAKING**: Validate key IDs in DID Documents.
- **BREAKING**: Remove Equihash.
- **BREAKING**: Update jsigs API calls.
- **BREAKING**: Add basisBlockHeight parameter.
- **BREAKING**: Require configuration proof.
- **BREAKING**: Update to use multibase.
- **BREAKING**: Update invoker/controller code.
- **BREAKING**: Add validation parameter set processing.
- **BREAKING**: Add URN DID validation for test network.
- Add more test coverage

## 5.0.0 - 2018-10-10

### Added
- **BREAKING**: Add `bedrock-ledger-context` peer dependency.
- Support for elector pool.

## 4.0.0 - 2018-10-01

### Changed
- **BREAKING**: Switch to a Promise based API.

## 3.0.0 - 2018-09-19

### Changed
- Use bedrock-validation 3.x.

## 2.0.0 - 2018-09-19

### Changed
- Replace old stateMachine API with new records API.
- Update ocap terminology.
- Update validators to use new cryptonym format.

## 1.0.0 - 2018-09-19

- See git history for changes.
