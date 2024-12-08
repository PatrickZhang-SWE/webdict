import { serve } from '@hono/node-server'
import { Hono } from 'hono'
import { parse, getDictTitle } from './Parser/ParserManagement.js'
import { addDict, addRecords, queryWord } from './Utils/sqlite.js'
import { getLanguageMeta } from './common/Languages.js'
import { setUpMorphology } from './Utils/HunspellMorphology.js'
import * as fs from 'fs';

const app = new Hono()

app.get('/', (c) => {
  return c.text('Hello Hono!')
})

app.get('/v1/word/:word', async (c) => {
  const word = c.req.param('word');
  return c.json(await queryWord(word));
})

app.post('/v1/admin/dict/morphology', async (c) => {
  const body = await c.req.parseBody();
  const aff = body['aff'];
  if (!aff || !(aff instanceof File)) {
    return c.body('No aff file.');
  }
  const dic = body['dic'];
  if (!dic || !(dic instanceof File)) {
    return c.body('No dic file.');
  }
  const affName = `${Math.random().toString(36).substring(7)}.${aff.name.split('.').pop()}`;
  const dicName = `${Math.random().toString(36).substring(7)}.${dic.name.split('.').pop()}`;
  const affPath = `./${affName}`;
  const dicPath = `./${dicName}`;
  try {
    await fs.promises.writeFile(affPath, new Uint8Array(await aff.arrayBuffer()));
    await fs.promises.writeFile(dicPath, new Uint8Array(await dic.arrayBuffer()));
    await setUpMorphology(affPath, dicPath);
  } catch (e) { 
    console.log(e);
    throw e;
   } finally {
    await fs.promises.unlink(affPath).catch(() => { });
    await fs.promises.unlink(dicPath).catch(() => { });
  }
  return c.json("Success");
})

app.post('/v1/admin/dict/upload', async (c) => {
  const body = await c.req.parseBody();
  const fileType = body['fileType'];
  if (typeof fileType !== 'string') {
    return c.body('No file type.')
  }
  const fromLanguage = body['fromLanguage'];
  if (typeof fromLanguage !== 'string') {
    return c.body('No from language.')
  }
  const keywordLanguage = getLanguageMeta(fromLanguage).id;
  const toLanguage = body['toLanguage'];
  if (typeof toLanguage !== 'string') {
    return c.body('No to language.')
  }
  const recordLanguage = getLanguageMeta(toLanguage).id;
  let data = body['file'];
  if (!(data instanceof File)) {
    return c.body('No file.');
  }
  const buffer = await data.arrayBuffer();
  const [ dictInfo, keyRecordPairs ] = await Promise.all([
    getDictTitle(fileType, buffer),
    parse(fileType, buffer),
  ]);
  dictInfo.keywordLanguage = keywordLanguage;
  dictInfo.recordLanguage = recordLanguage;
  const dictId = await addDict(dictInfo);
  if (!dictId) {
    return c.body('Failed to add dict.');
  }
  dictInfo.id = dictId;
  await addRecords(keyRecordPairs, dictInfo);
  return c.json(dictInfo);
})

const port = 3000
console.log(`Server is running on http://localhost:${port}`)

serve({
  fetch: app.fetch,
  port
})
