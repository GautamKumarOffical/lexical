---
'@lexical/y': patch
---

[fix] Refuse a local change that would delete text a collaborator wrote in the line being composed, instead of deleting it

While a composition (IME) holds back a collaborator's change to the line being composed, a local change that moves, replaces or removes what holds that text (moving the list item composed in, unwrapping an inline element around it, replacing a slot's paragraph), or takes text out of the inline element composed in, is no longer written: the editor reads the document again, so the change is undone and the collaborator's text stays, and `UNSUPPORTED_EDIT_WARNING` reports it with the new reason `'held-composition'`. The binding stays active. Removing the inline element composed in (or the slot it fills) is refused too until the composition ends.

Verify: compose with an IME in an inline element inside a list item while a collaborator types into the same line, then move the list item (or unwrap the element) before the composition ends: the move is undone, the collaborator's text is kept on every client, and `UNSUPPORTED_EDIT_WARNING` with `reason: 'held-composition'` is reported once.
