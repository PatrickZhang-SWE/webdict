import { serve } from '@hono/node-server'
import { Hono } from 'hono'
import { parse } from './Parser/MDXParser.js'

const app = new Hono()

app.get('/', (c) => {
  return c.text('Hello Hono!')
})

app.post('/admin/dict/upload', async (c) => {
  const body = await c.req.parseBody();
  let data = body['file'];
  if (data instanceof File) {
    const buffer = await data.arrayBuffer();
    await parse(buffer);
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
