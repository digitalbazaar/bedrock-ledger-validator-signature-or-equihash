/*!
 * Copyright (c) 2017-2019 Digital Bazaar, Inc. All rights reserved.
 */
'use strict';

const {config: {constants}} = require('bedrock');
const {schemas} = require('bedrock-validation');
const {maxLength} = require('../lib/constants');
const did = require('./did');
const didReference = require('./didReference');
const didUuid = require('./did-uuid');
const {serviceDescriptor, serviceId} = require('./service');
const urnUuid = require('./urn-uuid');

// can be a did or a url
const creator = {
  anyOf: [schemas.url(), did(), didReference(), didUuid()]
};

const caveat = {
  additionalProperties: false,
  required: [
    'type'
  ],
  type: 'object',
  properties: {
    type: {
      type: 'string',
      maxLength
      // FIXME: enable when term is finalized
      // enum: ['VeresOneElectorTicketAgent']
    }
  }
};

const invocationTarget = {
  anyOf: [did(), didUuid(), urnUuid()]
};

const capability = {
  additionalProperties: false,
  type: 'object',
  required: [
    'caveat',
    'id',
    'invocationTarget',
  ],
  properties: {
    caveat: {
      type: 'array',
      minItems: 1,
      items: caveat,
    },
    id: did(),
    invocationTarget
  }
};

const operationValidator = {
  title: 'Veres One Validator Config',
  type: 'object',
  additionalProperties: false,
  required: [
    'type',
    'validatorFilter',
    // FIXME: enable when Veres One code is setting up a validatorParameterSet
    // document
    // 'validatorParameterSet',
  ],
  properties: {
    type: {const: 'VeresOneValidator2017'},
    validatorFilter: {
      title: 'Validator Type Filter',
      type: 'array',
      minItems: 1,
      maxItems: 1,
      items: {
        additionalProperties: false,
        required: [
          'type',
          'validatorFilterByType'
        ],
        type: 'object',
        properties: {
          type: {const: 'ValidatorFilterByType'},
          validatorFilterByType: {
            type: 'array',
            minItems: 2,
            maxItems: 2,
            uniqueItems: true,
            items: {
              type: 'string',
              enum: ['CreateWebLedgerRecord', 'UpdateWebLedgerRecord']
            },
          }
        },
      },
    },
    validatorParameterSet: didUuid(),
  },
};
const configurationValidator = {
  title: 'Veres One Validator Config',
  type: 'object',
  additionalProperties: false,
  required: [
    'type',
  ],
  properties: {
    type: {const: 'VeresOneValidator2017'},
  },
};

const validatorConfig = {
  title: 'Veres One Validator Configuration',
  oneOf: [
    operationValidator,
    configurationValidator
  ]
};

const publicKey = {
  title: 'Veres One DID Public Key',
  additionalProperties: false,
  required: [
    'controller',
    'id',
    'type',
    'publicKeyMultibase'
  ],
  type: 'object',
  properties: {
    id: didReference(),
    type: {
      type: 'string',
      enum: ['Ed25519VerificationKey2020', 'X25519KeyAgreementKey2020'],
    },
    controller: did(),
    publicKeyMultibase: {
      type: 'string',
      // multibase base58 encoding of multicodec public key
      maxLength: 48
    }
  },
};

const didDocumentContext = {
  type: 'array',
  items: [
    {
      // the first context should be the DID Context
      const: constants.DID_CONTEXT_URL
    }, {
      // the second context should be the V1 Context
      const: constants.VERES_ONE_CONTEXT_V1_URL
    }, {
      // the remaining 2 contexts can be any of these
      anyOf: [{
        const: constants.WEB_LEDGER_CONTEXT_V1_URL
      }, {
        const: constants.ED25519_2020_CONTEXT_V1_URL
      }, {
        const: constants.X25519_2020_CONTEXT_V1_URL
      }]}
  ],
  maxItems: 4,
  minItems: 2,
};

const didDocument = {
  title: 'Veres One DID Document Base',
  additionalProperties: false,
  type: 'object',
  required: ['@context'],
  properties: {
    '@context': didDocumentContext,
    id: did(),
    // FIXME: be more specific with restrictions for all properties below
    invocationTarget,
    invoker: did(),
    assertionMethod: {
      type: 'array',
      minItems: 1,
      items: {
        anyOf: [didReference(), publicKey]
      }
    },
    authentication: {
      type: 'array',
      minItems: 1,
      items: {
        anyOf: [didReference(), publicKey]
      }
    },
    capabilityDelegation: {
      type: 'array',
      minItems: 1,
      items: {
        anyOf: [didReference(), publicKey]
      }
    },
    capabilityInvocation: {
      type: 'array',
      minItems: 1,
      items: {
        anyOf: [didReference(), publicKey]
      }
    },
    keyAgreement: {
      type: 'array',
      minItems: 1,
      items: {
        anyOf: [didReference(), publicKey]
      }
    },
    service: {
      type: 'array',
      minItems: 1,
      items: serviceDescriptor(),
    },
  },
};

const createDidDocument = {
  type: 'object',
  allOf: [
    didDocument,
    {
      title: 'Create Veres One DID Document',
      type: 'object',
      required: [
        'id',
        'capabilityInvocation',
      ],
    }
  ]
};

const updateDidDocument = {
  allOf: [
    didDocument,
    {
      title: 'Update Veres One DID Document',
      type: 'object',
      required: [
        'id',
        // it is possible to remove all methods during an update
      ],
    }
  ]
};

const patchContext = {
  type: 'array',
  maxItems: 2,
  minItems: 2,
  items: [
    {const: constants.JSON_LD_PATCH_CONTEXT_V1_URL},
    {
      type: 'object',
      required: ['value'],
      additionalProperties: false,
      properties: {
        value: {
          type: 'object',
          required: ['@id', '@context'],
          additionalProperties: false,
          properties: {
            '@id': {const: 'jldp:value'},
            '@context': didDocumentContext
          }
        }
      }
    }
  ]
};

const didDocumentPatch = {
  title: 'DID Document Patch',
  type: 'object',
  additionalProperties: false,
  required: [
    '@context',
    'patch',
    'sequence',
    'target'
  ],
  properties: {
    '@context': patchContext,
    target: {
      anyOf: [did(), didUuid()],
    },
    // FIXME: also support `frame` property later
    patch: {
      type: 'array',
      minItems: 1,
      items: {
        type: 'object',
        additionalProperties: false,
        required: [
          'op',
          'path'
        ],
        // FIXME: more strictly validate properties based on value of `op`
        properties: {
          op: {
            type: 'string',
            enum: ['add', 'copy', 'move', 'remove', 'replace', 'test']
          },
          from: {
            type: 'string',
            maxLength
          },
          path: {
            type: 'string',
            maxLength
          },
          value: {
            //type: ['number', 'string', 'boolean', 'object', 'array'],
          }
        },
      }
    },
    sequence: {
      type: 'integer',
      minimum: 0,
      maximum: Number.MAX_SAFE_INTEGER
    }
  },
};

const ContinuityElectorTypes = {
  type: 'string',
  enum: [
    'Continuity2017Elector',
    'Continuity2017GuarantorElector',
  ],
};

const Continuity2017Elector = {
  type: 'string',
  enum: ['Continuity2017Elector'],
};

const electorPoolDocument = {
  title: 'ElectorPool Document',
  type: 'object',
  additionalProperties: false,
  required: [
    '@context',
    'id',
    'electorPool',
    'controller',
    // FIXME: DOES THIS BELONG HERE? IT'S ALSO IN THE LEDGER CONFIG IN THE
    // ELECTOR SELECTION
    // 'maximumElectorCount',
    'type'
  ],
  properties: {
    '@context': didDocumentContext,
    id: didUuid(),
    controller: did(),
    type: {const: 'ElectorPool'},
    electorPool: {
      type: 'array',
      items: {
        type: 'object',
        required: [
          'id',
          'service',
          'type',
        ],
        properties: {
          id: urnUuid(),
          service: {
            anyOf: [serviceDescriptor(), serviceId()]
          },
          type: {
            anyOf: [
              Continuity2017Elector, {
                type: 'array',
                maxItems: 1,
                minItems: 1,
                items: Continuity2017Elector
              }, {
                type: 'array',
                maxItems: 2,
                minItems: 2,
                uniqueItems: true,
                items: ContinuityElectorTypes
              }]
          },
          capability: {
            type: 'array',
            minItems: 1,
            items: capability
          }
        }
      }
    },
    maximumElectorCount: {
      type: 'integer',
      minimum: 1,
    }
  },
};

const validatorParameterSet = {
  title: 'ValidatorParameterSet Document',
  type: 'object',
  additionalProperties: false,
  required: [
    '@context',
    'id',
    'allowedServiceBaseUrl',
    'controller',
    'type'
  ],
  properties: {
    '@context': didDocumentContext,
    id: didUuid(),
    controller: did(),
    type: {const: 'ValidatorParameterSet'},
    allowedServiceBaseUrl: {
      type: 'array',
      minItems: 1,
      items: {
        // FIXME: how should these be validated beyond string?
        // pattern startswith https:// ?
        type: 'string',
        maxLength
      }
    }
  },
};

const baseCapability = {
  type: 'object',
  additionalProperties: false,
  required: [
    'capability',
    'capabilityAction',
    'created',
    'invocationTarget',
    'proofValue',
    'proofPurpose',
    'type'
  ],
  properties: {
    // FIXME add a deterministic length for capability
    capability: {
      type: 'string',
      maxLength
    },
    capabilityAction: {
      type: 'string',
      enum: ['write'],
    },
    created: schemas.w3cDateTime(),
    invocationTarget,
    proofValue: {
      type: 'string',
      // this should be the multibase base58 representation of a 64-byte
      // ed25519 signature value; this is max 89 characters
      maxLength: 89
    },
    creator,
    proofPurpose: {
      type: 'string',
      enum: ['capabilityInvocation'],
    },
    type: {
      type: 'string',
      enum: ['Ed25519Signature2020']
    },
    verificationMethod: didReference()
  }
};

const creatorOrVerificationMethod = {
  oneOf: [{
    required: ['creator'],
    properties: {
      verificationMethod: {not: {}}
    }
  }, {
    required: ['verificationMethod'],
    properties: {
      creator: {not: {}}
    }
  }]
};

const writeCapability = {
  allOf: [
    baseCapability,
    creatorOrVerificationMethod, {
      properties: {
        capabilityAction: {
          enum: ['write'],
        },
        // FIXME: this is for testnet v2 only
        jws: {
          enum: ['MOCKPROOF'],
        },
      }
    }]
};

const updateWebLedgerRecord = {
  title: 'Update DID',
  type: 'object',
  required: [
    '@context',
    'creator',
    'proof',
    'recordPatch',
    'type'
  ],
  additionalProperties: false,
  properties: {
    '@context': schemas.jsonldContext([
      constants.WEB_LEDGER_CONTEXT_V1_URL,
      constants.ED25519_2020_CONTEXT_V1_URL,
    ]),
    creator,
    type: {const: 'UpdateWebLedgerRecord',
    },
    recordPatch: didDocumentPatch,
    proof: {
      anyOf: [{
        type: 'array',
        items: [writeCapability, writeCapability],
        additionalItems: false,
      }],
    }
  },
};

const ledgerConfiguration = {
  title: 'Veres One WebLedgerConfiguration',
  additionalProperties: false,
  required: [
    '@context',
    'consensusMethod',
    'electorSelectionMethod',
    'ledger',
    'ledgerConfigurationValidator',
    'operationValidator',
    'proof',
    'sequence',
    'type',
  ],
  type: 'object',
  properties: {
    '@context': schemas.jsonldContext([
      constants.WEB_LEDGER_CONTEXT_V1_URL,
      constants.ED25519_2020_CONTEXT_V1_URL
    ]),
    consensusMethod: {const: 'Continuity2017'},
    creator,
    electorSelectionMethod: {
      additionalProperties: false,
      required: [
        // maximumElectorCount is *not* required in the configuration
        'electorPool',
        'type',
      ],
      type: 'object',
      properties: {
        maximumElectorCount: {
          type: 'integer',
          minimum: 1,
        },
        electorPool: didUuid(),
        type: {
          // FIXME: using ElectorPoolElectorSelection for now
          // this should be a VeresOne specific method
          const: 'ElectorPoolElectorSelection'
        }
      }
    },
    ledger: {
      // FIXME: enforce? did:v1:eb8c22dc-bde6-4315-92e2-59bd3f3c7d59
      type: 'string',
      maxLength
    },
    ledgerConfigurationValidator: {
      type: 'array',
      maxItems: 1,
      minItems: 1,
      items: {
        additionalProperties: false,
        required: ['type'],
        type: 'object',
        properties: {
          type: {const: 'VeresOneValidator2017'}
        }
      }
    },
    operationValidator: {
      type: 'array',
      items: operationValidator
    },
    proof: {
      allOf: [
        schemas.linkedDataSignature2020(), {
          // FIXME: this is only for testnet_v2
          type: 'object',
          required: ['proofPurpose'],
          properties: {
            proofPurpose: {
              type: 'string',
              enum: ['assertionMethod']
            }
          }
        }
      ]
    },
    sequence: {
      type: 'integer',
      // FIXME: this is only for testnet_v2
      enum: [0],
      // minimum: 0,
    },
    type: {
      type: 'string',
      enum: ['WebLedgerConfiguration']
    }
  },
};

const uuidDidRecord = {
  title: 'UUID DID',
  type: 'object',
  required: [
    'type',
  ],
  properties: {
    type: {
      enum: [
        'ElectorPool',
        'ValidatorParameterSet',
      ]
    }
  },
  allOf: [{
    if: {properties: {type: {const: 'ElectorPool'}}},
    then: electorPoolDocument
  }, {
    if: {properties: {type: {const: 'ValidatorParameterSet'}}},
    then: validatorParameterSet
  }]
};

const createWebLedgerRecord = {
  title: 'CreateWebLedgerRecord',
  type: 'object',
  required: [
    '@context',
    'creator',
    'proof',
    'record',
    'type',
  ],
  additionalProperties: false,
  properties: {
    '@context': schemas.jsonldContext([
      constants.WEB_LEDGER_CONTEXT_V1_URL,
      constants.ED25519_2020_CONTEXT_V1_URL
    ]),
    creator,
    type: {const: 'CreateWebLedgerRecord'},
    proof: {
      anyOf: [{
        type: 'array',
        items: [writeCapability, writeCapability],
        additionalItems: false,
      }],
    },
    record: {
      type: 'object',
      required: [
        'id'
      ],
      properties: {
        id: {
          anyOf: [did(), didUuid()]
        }
      },
      allOf: [{
        if: {
          properties: {id: did()}
        },
        then: createDidDocument
      }, {
        if: {
          properties: {id: didUuid()}
        },
        then: uuidDidRecord
      }],
    }
  }
};

module.exports.operationValidator = () => operationValidator;
module.exports.updateDidDocument = () => updateDidDocument;
module.exports.didDocumentPatch = () => didDocumentPatch;
module.exports.electorPoolDocument = () => electorPoolDocument;
module.exports.ledgerConfiguration = () => ledgerConfiguration;
module.exports.operation = () => ({
  title: 'Veres One WebLedgerOperation',
  type: 'object',
  properties: {
    type: {
      enum: [
        'CreateWebLedgerRecord',
        'UpdateWebLedgerRecord'
      ]
    }
  },
  allOf: [{
    if: {
      properties: {
        type: {const: 'CreateWebLedgerRecord'}
      }
    },
    then: createWebLedgerRecord
  }, {
    if: {
      properties: {
        type: {const: 'UpdateWebLedgerRecord'}
      }
    },
    then: updateWebLedgerRecord
  }]
});
module.exports.validatorConfig = () => validatorConfig;
module.exports.validatorParameterSet = () => validatorParameterSet;
