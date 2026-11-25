import { SUPABASE_CONFIG } from '../config/supabase-config.js'
import '../view-models/gallery.css'
import './results.css'

const posters = import.meta.glob('../view-models/media/*.webp', { eager: true, query: '?url', import: 'default' })
const standings = document.querySelector('#standings')
const status = document.querySelector('[role=status]')
const refresh = document.querySelector('#refresh')
let rows

function element(tag, text) {
  const node = document.createElement(tag)
  node.textContent = text
  return node
}

function render() {
  if (!rows) return
  const teachers = document.querySelector('[name=ballot]:checked').value === 'teachers'
  standings.replaceChildren()
  for (const section of ['6A', '6B', '6C']) {
    const group = document.createElement('section')
    group.append(element('h2', 'Class ' + section))
    const list = document.createElement('ol')
    for (const row of rows.filter(row => row.section === section && row.teacher === teachers)) {
      const entry = document.createElement('li')
      const poster = posters['../view-models/media/' + row.asset + '.webp']
      entry.append(element('strong', String(row.place)))
      if (poster) {
        const image = document.createElement('img')
        image.src = poster
        image.alt = ''
        entry.append(image)
      }
      const details = document.createElement('div')
      details.append(element('h3', row.title || 'Ornament ' + row.id))
      if (row.title || row.credit) details.append(element('small', [row.id, row.credit].filter(Boolean).join(' · ')))
      const count = row.votes + (row.votes === 1 ? ' rating' : ' ratings')
      details.append(element('p', Number(row.average).toFixed(2) + ' / 10 · ' + count))
      entry.append(details)
      list.append(entry)
    }
    group.append(list.children.length ? list : element('p', 'No ' + (teachers ? 'teacher' : 'audience') + ' ratings yet.'))
    standings.append(group)
  }
}

async function load() {
  if (refresh.disabled) return
  refresh.disabled = true
  status.textContent = 'Loading results…'
  try {
    const { url, publishableKey } = SUPABASE_CONFIG
    const response = await fetch(url + '/rest/v1/rpc/ornament_results', {
      method: 'POST', headers: { apikey: publishableKey, 'Content-Type': 'application/json', Authorization: 'Bearer ' + publishableKey },
      body: '{}', cache: 'no-store', signal: AbortSignal.timeout(15000)
    })
    if (!response.ok) throw Error()
    const data = await response.json()
    if (!Array.isArray(data)) throw Error()
    rows = data
    render()
    status.textContent = 'Updated ' + new Date().toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })
  } catch {
    status.textContent = rows ? 'Refresh failed. Showing the last results.' : 'Results could not load. Try refreshing.'
  } finally {
    refresh.disabled = false
  }
}

document.querySelector('fieldset').addEventListener('change', render)
refresh.addEventListener('click', load)
document.addEventListener('visibilitychange', () => { if (!document.hidden) load() })
load()
