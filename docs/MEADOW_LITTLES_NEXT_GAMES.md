# Meadow Market Littles: ten next game ideas

Design brief for the next Littles development cycle. These are concepts, not implemented games. Keep the existing full-screen farm artwork, large touch targets, short instructions, gentle feedback, and local-only linked play. Reuse the existing farmer, produce, reward, care, and game-result audio; do not introduce recording or voice recognition.

## 1. Listen, Look, Harvest

Farmer Jade names an item and shows its picture briefly. A slow-moving farm belt then carries the matching item among a few distractors. Children tap the named item. Start with two choices and slow movement; add choices and pace gently as they succeed. Reuse existing produce voice clips and the corresponding produce art. Solo score is a basket of correct picks; linked play can alternate turns or share a cooperative basket.

## 2. Meadow Memory Pairs

A solo memory game with familiar produce, animals, and farm objects. Match pairs, with optional spoken names when cards turn over. Begin with three pairs and offer larger boards later. Use existing produce/animal images and audio. Linked play can use the existing Harvest Memory Match rules with more small themed decks.

## 3. Pack the Spoken Order

Farmer Jay speaks a short market order and shows one illustrated shopping list. Children drag or tap those items into a basket from a small mixed stall. Orders grow from one item to three. Solo play rewards completing the basket; linked play can give each player a turn with the same order.

## 4. What Changed in the Paddock?

Show a quiet farm picture, hide it briefly, then show it again with one visible change: an apple moved, a hat changed colour, or a duck is missing. Children tap the changed place. Start with one big change and later offer two. Use current scene art and short spoken prompts. Linked play can alternate who spots each change.

## 5. Copy the Farmer’s Pattern

Play a short sequence of spoken produce or animal names with matching picture cards. Children repeat it by tapping the cards in order. Start with two beats and increase only after success. Reuse existing item audio and pictures. Linked mode can take turns extending one shared sequence.

## 6. Find the Animal’s Home

A farmer says which animal needs help, then children choose its matching home from two or three large illustrated choices. Later rounds can include a simple extra clue such as “the hen’s home has a nest.” Reuse animal care and farmer voice clips. Two linked players can cooperate, one choosing the animal and one its home.

## 7. Apple Cart Sort

Move a handful of large items into the correct baskets: fruit, vegetables, or farm tools. Instructions are spoken and shown as pictures. Keep early rounds to two baskets and a few objects. Reuse the market sorting sounds and item art. Linked play can alternate sorting turns or use a shared cooperative target.

## 8. Gentle Harvest Dash

A short timed round where a spoken target and its picture appear, then matching produce rolls past on a slow belt. Children tap only the named crop and ignore other farm items. Give a generous first round and never punish a miss harshly. Reuse existing crop audio and market sounds. Linked play should use alternating turns for fairness, not a reaction-time race between different devices.

## 9. Build the Farm Picture

A large farm picture is split into a few chunky pieces. Children drag each piece into its matching outline, with a gentle snap and spoken object name. Start with three pieces. Reuse existing scene art and completion audio. Linked players can place alternating pieces in one shared picture.

## 10. Which Basket Is Fuller?

Show two market baskets with a small number of familiar items. Farmer Rhys asks which has more, fewer, or the same. Children tap a basket. Begin with clearly different quantities and use counting audio already in the game. Linked players can take turns answering the same gentle questions.

## Shared implementation notes

- Keep each round short and replayable, with a clear “play again” and “choose another game” result screen.
- Use the existing `meadowAudio.speak(...)` vocabulary and available clips; check actual asset names before wiring a game. Fall back to concise on-screen text if a specific clip does not exist.
- Build linked variants on the existing QR/code pairing and local WebRTC data channel. The connection must stay in memory across lobby and game changes; do not add a server, account, relay, or internet signalling.
- For ages 3–6, scale difficulty through fewer or more choices, longer or shorter preview time, and slower or faster movement. Keep a calm untimed option wherever practical.
- Add new games to `minigames.js`, asset precache, farmer audio guidance, and regression checks only when their full gameplay loop is implemented.
