import fs from 'node:fs';
import path from 'node:path';

import Hypercore from 'hypercore';

export async function openEventLog({ coreDir }) {
  fs.mkdirSync(coreDir, { recursive: true });

  const corePath = path.join(coreDir, 'events');
  const core = new Hypercore(corePath, { valueEncoding: 'json' });
  await core.ready();
  return core;
}
