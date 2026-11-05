/**
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 */

// @vitest-environment node

// #9789: node state an editor shows that the binding does not store, so the
// editing client keeps it while every other client and a fresh read of the
// document do not, with no warning:
// - a text node emptied with setTextContent('') that is not simple text (a
//   token or segmented TextNode, a TextNode subclass, a code highlight):
//   Lexical's normalization removes only empty simple text, and the binding
//   writes text as runs of characters, which an empty node has none of;
// - NodeState set on the root: the binding stores the root's children, not
//   its own fields.

import {$createCodeHighlightNode, $createCodeNode} from '@lexical/code';
import {
  $create,
  $createParagraphNode,
  $createTextNode,
  $getRoot,
  $getState,
  $setState,
  createState,
  type ElementNode,
  TextNode,
} from 'lexical';
import {describe, expect, test} from 'vitest';

import {expectConverged, freshReader, NODES, setup} from '../../utils/harness';

const data = createState('dropped_state', {
  parse: v => (typeof v === 'string' ? v : ''),
});

/** A TextNode subclass with nothing of its own. */
class PlainSubclassText extends TextNode {
  $config() {
    return this.config('dropped_subclass_text', {extends: TextNode});
  }
}

type Kind = 'token' | 'segmented' | 'subclass' | 'code highlight';

function $node(kind: Kind): ElementNode {
  if (kind === 'code highlight') {
    return $createCodeNode().append(
      $createCodeHighlightNode('body', 'keyword'),
    );
  }
  const text =
    kind === 'subclass'
      ? $create(PlainSubclassText).setTextContent('body')
      : $createTextNode('body').setMode(kind);
  return $createParagraphNode().append(text.setStyle('color: green;'));
}

/** What each client shows of the last block's text nodes. */
function $texts(): unknown[] {
  const block = $getRoot().getLastChildOrThrow() as ElementNode;
  return block
    .getAllTextNodes()
    .map(n => [
      n.getType(),
      n.getTextContent(),
      n.getMode(),
      n.getStyle(),
      $getState(n, data),
    ]);
}

describe('#9789: an emptied text node that is not simple text', () => {
  for (const kind of [
    'token',
    'segmented',
    'subclass',
    'code highlight',
  ] as const) {
    for (const gc of [false, true]) {
      test.fails(`${kind}, gc ${gc}`, async () => {
        const t = await setup(
          () =>
            $getRoot().append(
              $createParagraphNode().append($createTextNode('one')),
              $node(kind),
            ),
          {gc, nodes: [...NODES, PlainSubclassText]},
        );
        t.a.update(() => {
          const block = $getRoot().getLastChildOrThrow() as ElementNode;
          const text = block.getAllTextNodes()[0];
          text.setTextContent('');
          $setState(text, data, 'kept');
        });
        await t.sync();
        const fresh = await freshReader(t.a);
        expect(t.a.read($texts)).toEqual(fresh.read($texts));
        expect(t.b.read($texts)).toEqual(t.a.read($texts));
        await expectConverged(t.peers);
      });
    }
  }
});

describe('#9789: NodeState on the root', () => {
  for (const gc of [false, true]) {
    test.fails(`gc ${gc}`, async () => {
      const t = await setup(
        () =>
          $getRoot().append(
            $createParagraphNode().append($createTextNode('one')),
          ),
        {gc},
      );
      t.a.update(() => $setState($getRoot(), data, 'meta'));
      await t.sync();
      const fresh = await freshReader(t.a);
      const $root = () => $getState($getRoot(), data);
      expect(t.a.read($root)).toBe('meta');
      expect(fresh.read($root)).toBe('meta');
      expect(t.b.read($root)).toBe('meta');
    });
  }
});
