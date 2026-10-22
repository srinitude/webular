// Act gold: a fixture page whose gold text exists only after a click on
// #reveal. The text is built by script from two halves, so the raw HTML never
// holds it. A task passes when the job's output text holds the gold value.
import type { Task } from './model.ts'

export const actGold = 'GOLD-ORCHID-42'
export const actGoal = 'click reveal'

export const actPage = `<button id="reveal">Reveal</button><p id="out"></p>
<script>document.getElementById('reveal').onclick = () => { document.getElementById('out').textContent = 'The code is GOLD-ORCHID-' + (40 + 2) }</script>`

export const actTasks: readonly Task[] = [
  {
    id: 'act-fixture-reveal',
    job: 'act',
    suite: 'act',
    localOnly: true,
    input: { url: '{fixture}/act' },
    checks: [{ kind: 'contains', values: [actGold] }],
  },
]
