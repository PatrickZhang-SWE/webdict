import { serve } from '@hono/node-server'
import { Hono } from 'hono'
import { parse } from './Parser/ParserManagement.js'
import { stringBufferToString } from 'hono/utils/html'

const app = new Hono()

app.get('/', (c) => {
  return c.text('Hello Hono!')
})

app.post('/v1/admin/dict/upload', async (c) => {
  const body = await c.req.parseBody();
  const fileType = body['fileType'];
  let data = body['file'];
  if (data instanceof File) {
    const buffer = await data.arrayBuffer();
    if (typeof fileType !== 'string') {
      return c.body('No file type.')
    }
    await parse(fileType, buffer);
    return c.body('Process Successfully.')
  } else {
    return c.body(`Not supported ${data}`)
  }
})

const port = 3000
console.log(`Server is running on http://localhost:${port}`)

serve({
  fetch: app.fetch,
  port
})
