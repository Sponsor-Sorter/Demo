# Frontlines AI strategy guide

This describes the strategy code used by Frontlines’ bots. The difficulty slider changes their planning priorities and some specific checks. It does not give them better dice, extra troops or access to an opponent’s cards.

## Difficulty slider

Most planning weights increase continuously. A few safeguards and behaviours have exact thresholds. These are the hints shown by the sliders in Game Modes & Rules and the host’s lobby.

| Setting | What changes | Why it matters |
| --- | --- | --- |
| **0 — Classic** | Uses the original nearby-fight and border-pressure play style. No connected elimination planning or proactive alliance offers. | Keeps the familiar, less strategic opponent. |
| **1–24 — Learning** | Chooses an affordable bonus to pursue; weighs useful captures, capitals, garrisons and connected fortification. These weights start low. | Gives the army an objective instead of simply expanding wherever it can. |
| **25–34 — Tactical** | Can initiate alliances from round 3, if Alliances is enabled and a suitable partner exists. | Allows cooperation without automatically trusting every neighbour. |
| **35–39** | Adds a hard attack veto when an attack would leave the source capital below its planned garrison. | Stops a promising attack from exposing an important capital. |
| **40** | Checks affordable connected elimination routes against opponents with at most five remaining territories. | Allows it to hunt a small rival and inherit that rival’s cards. |
| **41–49** | Also penalizes exposure to other enemy armies beside the attacking source. | Considers the counterattack after the current battle. |
| **50–74 — Veteran** | Increases the relative weight of completing bonuses, breaking enemy income and defending important borders. | Makes the bot more deliberate about the reinforcement economy. |
| **75–99 — Expert** | Further strengthens capital pressure, garrison targets and loss discipline. | Makes expansion more selective and fronts better supplied. |
| **100 — Expert, maximum** | Uses the maximum configured planning weights. | This is the strongest setting of this policy, not a guarantee of perfect play. |

The 50 and 75 bands describe stronger weighting, rather than suddenly unlocking every strategy listed there. Bots can already consider bonus completion, bonus denial and capitals at lower positive settings. Safe alliance replies and accepted allied plans are also available before the proactive-offer threshold. At every setting, an accepted pact prevents attacks on that ally until the pact is ended.

## What the bot can know

It receives a deliberately limited observation:

- Visible territory owners, troop counts and legal connections.
- Bonus regions and reinforcement values.
- Chosen capitals, living players and the current phase.
- Public card counts, the current trade value and its own cards.
- Its accepted alliances, its own relationship memory and an applicable allied plan.

The policy receives no deck order, future dice, random-generator state or other players’ card identities. Its decisions are submitted through the normal game rules. Online dice and outcomes are computed by the server. Difficulty never changes the dice distribution or reinforcement rules.

## Strategies: when, why and how

### 1. Choose an achievable bonus

**When:** At positive difficulty, whenever the board is evaluated.

**Why:** A completed bonus produces recurring income. An expensive region with too many entrances can cost more to defend than it earns.

**How:** It rates each incomplete, unblocked bonus using its income, the proportion already held, the visible cost of the remaining defenders, the number of connections crossing its outline and its distance from the bot’s current holdings. It favours nearby progress and fewer exposed entrances. A region containing an accepted ally is excluded as a conquest focus. This uses the map’s actual graph, rather than hardcoded instructions to take Australia on every map.

### 2. Choose a supported capital

**When:** During Capitals setup.

**Why:** Capitals provide income, defend more strongly and are victory objectives.

**How:** It prefers a territory with troops already present, friendly neighbours, less immediate enemy pressure and useful access to its intended bonus. As difficulty rises, threat, income access and useful defensive gates matter more. It chooses from owned territories only. The capital stays in that territory for the match.

### 3. Reinforce defence or assemble an attack

**When:** During Draft.

**Why:** Spreading new troops evenly can leave every army too weak to achieve anything.

**How:** It compares two uses for each eligible territory: closing a defensive shortfall, or creating an affordable attack against a valuable neighbour. Threatened capitals receive a large defensive premium. Completed bonus borders and gates protecting interior holdings receive additional weight. It places troops in small batches and re-evaluates as those placements change the position. Idle interior armies are generally lower priority.

### 4. Complete a reinforcement bonus

**When:** An adjacent capture would take the last missing territory of a bonus.

**Why:** One capture can unlock an entire region’s recurring income.

**How:** The last territory receives a completion reward scaled by that region’s bonus value and difficulty. It still has to pass the attack’s troop-cost and safety checks. A high-value region is not permission to attack with an inadequate army.

### 5. Break an opponent’s bonus

**When:** An opponent owns a complete bonus and the bot can attack one of its border territories.

**Why:** Taking one territory can remove that opponent’s extra income on their next Draft.

**How:** It adds a denial reward based on the enemy bonus’s reinforcement value. This reward grows with difficulty. The attack must be adjacent, must not violate an alliance, and must remain affordable. It can prefer a cheap interruption over an expensive attempt to conquer the whole region.

### 6. Earn a useful card without overextending

**When:** The bot has not yet captured a territory during its turn.

**Why:** One successful capture earns a card at turn end; several captures do not earn several cards that turn.

**How:** Before the first capture, targets receive an additional card incentive. That incentive disappears after a capture. The bot then needs another reason to keep attacking, such as income, a capital, an elimination or a worthwhile frontier improvement.

### 7. Budget losses before attacking

**When:** Before each roll or subsequent attack decision.

**Why:** A legal attack is not necessarily a good attack.

**How:** It estimates a conservative visible troop cost. Capitals are priced more heavily because of their stronger defence. It requires a surplus above that estimated cost; this margin increases with difficulty. It also discounts expected losses and the weakening of important source garrisons. It stops when no available attack clears its value threshold. These are estimates, not exact blitz probabilities or knowledge of the coming roll.

### 8. Protect exposed capitals

**When:** Reinforcing, attacking from a capital, allocating captured-territory troops or fortifying.

**Why:** Capturing elsewhere can be a bad exchange if it loses a capital immediately afterwards.

**How:** An exposed capital has a stronger garrison target, with a target of at least four troops before difficulty interpolation. At 35 and above, an attack from that capital is rejected if its estimated cost would leave fewer than the planned guard. An entirely interior capital can be left with the compulsory one unit: the bot does not treat a capital surrounded by friendly territories as immediately exposed.

### 9. Supply choke points and bonus entrances

**When:** Calculating garrisons, placing reinforcements and choosing fortification destinations.

**Why:** A border feeding protected interior territories can defend more of the empire than an isolated frontier does.

**How:** The policy identifies friendly interior neighbours behind each frontier and values the resulting gate. It gives completed-bonus borders more protection. This is a bounded graph heuristic, not a full mathematical search for every possible choke point.

### 10. Consider the other enemy beside the attacking army

**When:** Above difficulty 40, before committing an attack.

**Why:** Defeating one neighbour can expose the army to another.

**How:** It examines the strongest other hostile neighbour of the source and penalizes leaving that army an attractive counterattack. It does not assume different opponents can combine their troops into one army or predict a private agreement between them.

### 11. Hunt profitable eliminations

**When:** At difficulty 40 or above, when the target player has at most five territories left.

**Why:** An elimination removes a rival and transfers that rival’s cards to the attacker.

**How:** It checks the visible cost of all that rival’s remaining territories and requires spare troops beyond that estimate. It then looks for a connected chain beginning at the proposed target. The reward includes the publicly visible number of cards and the current trade value. It does not inspect those cards’ identities. A rival scattered behind unrelated enemies or allies will not be treated as a simple connected elimination. The bounded greedy check can miss a more complicated valid route.

### 12. Move enough troops forward while keeping a guard

**When:** After a successful conquest.

**Why:** Moving every available troop forward can abandon an important source; moving too few can strand the attack.

**How:** It calculates the source’s garrison target, leaves that guard where feasible and moves the remaining legal amount into the new territory. The amount is not limited to the dice used. The next decision is made from the resulting position, so another attack still has to justify its risk.

### 13. Fortify connected frontiers

**When:** After attacking, or when no further attack is worthwhile.

**Why:** Troops sitting safely inside the empire can often do more at a threatened border or capital.

**How:** It considers only destinations connected through its own territories. It moves spare troops above the source’s planned garrison, prefers useful frontiers and avoids draining a source with a more urgent defensive need. A successful fortification ends the turn. If no useful move exists, it ends without moving troops.

### 14. Trade cards according to the actual rules

**When:** A forced trade is due, including a five-card hand at the start of a turn or enough inherited cards after an elimination.

**Why:** Cards become troops, but the bot must obey the same hand limits and trade rules as players.

**How:** It chooses a legal three-of-a-kind or one-of-each set. It uses the selected Fixed, Progressive or Exponential reinforcement rules. A fifth card earned by the end-turn capture award waits for the next turn’s trade; an award cannot take an untraded five-card hand to six. It does not secretly turn in an invalid set or receive a special AI award.

### 15. Evaluate alliance offers

**When:** Another player offers an alliance and Alliances is enabled.

**Why:** Cooperation can protect a flank, but helping a dominant neighbour win is not useful cooperation.

**How:** At positive difficulty it checks the number of living players, existing allies, trust, public army strength and capital control. It rejects unsuitable or strongly distrusted partners, excessive alliances, and certain offers from a dominant player near victory. Classic retains its more accepting response. A pact is not a permanent promise to lose: final-two or all-allied deadlocks are released through an explicit pact break.

### 16. Propose an alliance

**When:** Difficulty 25 or above, Alliances enabled, round 3 or later, on a staggered eligible turn.

**Why:** Bots should sometimes initiate cooperation rather than only answer a player.

**How:** A bot checks for a suitable, non-hostile partner without an existing pact. Eligibility is staggered by seat and round to avoid constant offers. Proposals and acceptance use the same normal chat and pact rules. A proposal does not grant access to the partner’s cards or control of its units.

### 17. Follow a safe joint plan

**When:** An accepted ally requests an attack on a player or territory, or asks it to defend a territory.

**Why:** Coordination should influence the army without allowing another player to order it into a suicidal attack.

**How:** It checks ownership, trust and visible available troops. A defend order must refer to its own territory. An attack order needs a feasible adjacent force with a safety margin. Accepted plans influence scoring; they do not bypass legal movement, defence checks or self-preservation. Plans expire after two rounds and are re-evaluated as the board changes. A bot can acknowledge or decline a plan.

### 18. Remember relationships without revenge suicide

**When:** Resolving attacks, social interactions and subsequent diplomatic or target decisions.

**Why:** Betrayal and cooperation should affect future choices.

**How:** The bot keeps a small private trust record. Distrust can block an alliance or allied plan. Trust also acts as a small target-scoring tie-breaker. It never overrules the safety veto merely to pursue revenge, and private relationship memory is not sent to other players.

### 19. Capture enemy capitals and approach victory

**When:** In Capitals games, when an enemy capital is adjacent or a useful attack moves the army closer to one.

**Why:** Each held capital provides +2 Draft troops, and controlling every chosen capital wins the match. Taking a capital also removes that income from its previous holder.

**How:** Capital targets receive a reward that grows with difficulty. A graph-distance bonus can favour a legal attack that shortens the route toward an enemy capital. Routes exclude accepted allies. The capital's stronger defence is included in estimated cost, and the army still has to retain its required guard and pass the attack safety checks. It does not blindly march through an unaffordable opponent just because a capital is behind them.

## What stronger difficulty does not mean

- It does not search every possible future turn or guarantee the best move.
- It can lose to bad dice or be outplayed.
- Exact win rates are not guaranteed to increase at every single slider point.
- One live match does not automatically train a machine-learning model. Improvements come from recorded observations, reproducible checks and deliberate changes to the policy.

## Implementation references

- `scripts/ai_commander.gd`: public observation whitelist, bonus focus, costs, garrisons, attacks, elimination chains, occupation and fortification.
- `scripts/game.gd`: Classic policy, normal dice, Draft batches and required card trades.
- `scripts/match_features.gd`: native/local diplomacy, trust, allied plans and proactive offers.
- `backend/ai_policy.mjs` and `backend/ai_runtime.mjs`: the online policy and bounded server-side decision scheduler.
- `scripts/ai_briefing.gd`: the shared difficulty labels and slider hints.

The shared planning kernel is compared between native and online implementations using the same public-observation fixtures. Integration, permission and real multiplayer checks remain necessary in addition to those policy comparisons.
