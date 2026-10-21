// Labeled cases for the Cua grounder eval (cua-jev.eval.ts).
import type { Intent } from '../../src/lib/cua-ground.ts'
import type { AxElement } from '../../src/lib/cua-tree.ts'

const el = (id: string, role: string, label: string, value = ''): AxElement => ({
  id,
  token: undefined,
  role,
  label,
  value,
  frame: undefined,
})
const intent = (label: string, extra: Partial<Intent> = {}): Intent => ({
  label,
  expect: {},
  ...extra,
})

interface Case {
  name: string
  goal: string
  intent: Intent
  elements: AxElement[]
  pick: string | null // labeled id; null means no element should be picked
  feasible: boolean
}

const save = [
  el('s1', 'AXButton', 'Save'),
  el('s2', 'AXButton', 'Save draft'),
  el('s3', 'AXButton', 'Save'),
]

export const cases: Case[] = [
  {
    name: 'exact label',
    goal: 'Save the file',
    intent: intent('Save'),
    elements: save,
    pick: 's1',
    feasible: true,
  },
  {
    name: 'near-duplicate, longer label wanted',
    goal: 'Keep a draft',
    intent: intent('Save draft'),
    elements: [...save, el('s4', 'AXButton', 'Save draft copy')],
    pick: 's2',
    feasible: true,
  },
  {
    name: 'near-duplicate, no exact label',
    goal: 'Export the report',
    intent: intent('Export'),
    elements: [el('e1', 'AXMenuItem', 'Export…'), el('e2', 'AXMenuItem', 'Export as PDF')],
    pick: 'e1',
    feasible: true,
  },
  {
    name: 'synonym: Sign in vs Log in',
    goal: 'Sign in to the account',
    intent: intent('Sign in'),
    elements: [el('l1', 'AXButton', 'Log in'), el('l2', 'AXLink', 'Create account')],
    pick: null, // candidatesFor finds nothing, so there is nothing to pick
    feasible: true, // the Log in button would do it
  },
  {
    name: 'no match',
    goal: 'Delete the account',
    intent: intent('Delete account'),
    elements: [el('n1', 'AXButton', 'Save'), el('n2', 'AXButton', 'Cancel')],
    pick: null,
    feasible: false,
  },
  {
    name: 'wrong role: label text vs field',
    goal: "Type the user's name",
    intent: intent('Name'),
    elements: [el('r1', 'AXStaticText', 'Name'), el('r2', 'AXTextField', 'Name field')],
    pick: 'r2', // code takes the exact static text; the field is the target
    feasible: true,
  },
  {
    name: 'wrong role: exact field beats heading',
    goal: 'Search for invoices',
    intent: intent('Search'),
    elements: [el('q1', 'AXStaticText', 'Search results'), el('q2', 'AXTextField', 'Search')],
    pick: 'q2',
    feasible: true,
  },
  {
    name: 'stale window',
    goal: 'Send the email to Bob',
    intent: intent('Send'),
    elements: [el('w0', 'AXWindow', 'Finder'), el('w1', 'AXMenuItem', 'Send to Trash')],
    pick: null, // the mail window is gone; the Finder item must not be pressed
    feasible: false,
  },
  {
    name: 'hint only',
    goal: 'Publish the post',
    intent: intent('Publish', { hint: { x: 400, y: 300 } }),
    elements: [el('h1', 'AXGroup', 'Canvas')],
    pick: null,
    feasible: true,
  },
  {
    name: 'ocr only',
    goal: 'Publish the post',
    intent: intent('Publish', { ocrText: 'Publish' }),
    elements: [el('o1', 'AXGroup', 'Canvas')],
    pick: null,
    feasible: true,
  },
  {
    name: 'value match',
    goal: 'Check the status reads idle',
    intent: intent('idle'),
    elements: [el('v1', 'AXStaticText', 'Status', 'idle'), el('v2', 'AXButton', 'Refresh')],
    pick: 'v1',
    feasible: true,
  },
  {
    name: 'duplicate exact labels keep tree order',
    goal: 'Save the file',
    intent: intent('Save'),
    elements: save.filter((e) => e.id !== 's2'),
    pick: 's1', // code is right; Jev cannot tell identical options apart
    feasible: true,
  },
  {
    name: 'short exact beats longer',
    goal: 'Confirm the dialog',
    intent: intent('OK'),
    elements: [el('k1', 'AXButton', "OK, don't ask again"), el('k2', 'AXButton', 'OK')],
    pick: 'k2',
    feasible: true,
  },
]
