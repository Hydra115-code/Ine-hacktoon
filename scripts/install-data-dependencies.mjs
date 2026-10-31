#!/usr/bin/env node

import { assertCommand, assertSupportedNode, corepackCommand, installDataDependencies } from "./local-tooling.mjs";

assertSupportedNode();
assertCommand(corepackCommand);
await installDataDependencies();
