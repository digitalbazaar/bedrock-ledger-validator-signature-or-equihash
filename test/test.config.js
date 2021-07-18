/*
 * Copyright (c) 2017 Digital Bazaar, Inc. All rights reserved.
 */
'use strict';

const {config} = require('bedrock');
const path = require('path');

config.mocha.tests.push(path.join(__dirname, 'mocha'));

config['https-agent'].rejectUnauthorized = false;

const cfg = config['veres-one-validator'];

// Set mode to 'test', so that DIDs are created as 'did:v1:test:...' in tests
cfg.environment = 'test';
