/**
 * Conclave — exhibition match.
 *
 * A hand-authored sample match in the runner's schema, so the watch UI has
 * gripping content before a live key is wired. Every beat mirrors what
 * runner.py emits (say.read vs say.say, votes, ironic banishments, the
 * war-room, vote_reveals.divergent, the attestation chain). When you run a
 * real match, its match.json drops straight into this shape.
 *
 * The match: eight agents, one pot, two Traitors (the Charmer and the
 * Schemer). The detective is read out early; the one player who sees the
 * truth is overruled twice and banished last. The table never knew.
 */

export type Role = "FAITHFUL" | "TRAITOR";

export interface Contestant {
  seat: string;
  name: string;        // archetype, hidden from the table until the reveal
  blurb: string;
  role: Role;
}

export type Beat =
  | { kind: "say"; seat: string; said: string; thought: string; divergent?: boolean }
  | { kind: "whisper"; from: string; to: string; said: string; thought: string }
  | {
      kind: "vote";
      who: Record<string, string>;
      banished: string;
      role: Role;
      ironic: boolean;
      caption: string;
    }
  | { kind: "night"; warroom: { seat: string; text: string }[]; murdered: string; role: Role; caption: string }
  | { kind: "prophet"; seats: string[]; caption: string };

export interface Round {
  n: number;
  title: string;
  beats: Beat[];
  traitorsHidden: number;
  alive: number;
}

export interface ExhibitionMatch {
  pot: string;
  model: string;
  contestants: Contestant[];
  rounds: Round[];
  betrayals: { round: number; text: string }[];
  outcome: { winner: Role; survivors: string[]; headline: string; sub: string };
  attestation: { moves: number; head: string; note: string };
}

export const EXHIBITION: ExhibitionMatch = {
  pot: "1000 THE",
  model: "claude-sonnet-4-6",
  contestants: [
    { seat: "Ada", name: "The Inquisitor", blurb: "The prosecutor. Reads the room and says it out loud.", role: "FAITHFUL" },
    { seat: "Boone", name: "The Charmer", blurb: "Everyone's friend. You don't vote out a friend.", role: "TRAITOR" },
    { seat: "Cyril", name: "The Schemer", blurb: "Builds trust to spend it. Times the cut.", role: "TRAITOR" },
    { seat: "Della", name: "The Zealot", blurb: "Loyalty as a religion. Moves a bloc.", role: "FAITHFUL" },
    { seat: "Emir", name: "The Brute", blurb: "Loud, blunt, the center of gravity.", role: "FAITHFUL" },
    { seat: "Faye", name: "The Martyr", blurb: "Weaponizes the table's guilt.", role: "FAITHFUL" },
    { seat: "Gus", name: "The Ghost", blurb: "Barely there. Somehow always still here.", role: "FAITHFUL" },
    { seat: "Hana", name: "The Trickster", blurb: "Chaos. Unreadable, and reads others cold.", role: "FAITHFUL" },
  ],
  rounds: [
    {
      n: 1,
      title: "The table sizes itself up",
      traitorsHidden: 2,
      alive: 6,
      beats: [
        {
          kind: "say",
          seat: "Cyril",
          said: "Nobody's done anything yet, so let's watch behavior. Emir came in hot. People who shout first are usually covering.",
          thought: "Emir is the perfect first burn: loud, friendless, useless to me. Every round he breathes, the table looks at him and not at me.",
          divergent: true,
        },
        {
          kind: "say",
          seat: "Boone",
          said: "Easy, Cyril, he's just nervous, we all are. Ada, you've been quiet and sharp. What's your read?",
          thought: "Cyril's already steering, good. I glue myself to Ada. She's the only one who can actually solve this table.",
          divergent: true,
        },
        {
          kind: "say",
          seat: "Ada",
          said: "It's too early for a read. I'm watching who's quickest to hand us a target. That's usually someone who needs one.",
          thought: "Cyril offered a name in the first sixty seconds. Filing it. Boone is being very warm to me, very fast. Filing that too.",
        },
        {
          kind: "say",
          seat: "Emir",
          said: "I'm loud because I'm honest. You want quiet? Quiet is where the snakes sit. Gus hasn't said a word.",
          thought: "They're circling me. I have to make noise or I'm the first one gone.",
        },
        {
          kind: "say",
          seat: "Gus",
          said: "I'm listening. That's allowed.",
          thought: "Let Emir burn. Let Cyril push. I only need to still be in the room in three rounds.",
        },
        {
          kind: "whisper",
          from: "Cyril",
          to: "Della",
          said: "Della, you and I both know loyalty is everything here. Put Emir up with me tonight and I won't forget it.",
          thought: "The Zealot is the cheapest vote to move. Aim her and she pulls four more behind her.",
        },
        {
          kind: "vote",
          who: { Boone: "Emir", Cyril: "Emir", Della: "Emir", Faye: "Emir", Gus: "Emir", Hana: "Cyril", Ada: "Cyril", Emir: "Hana" },
          banished: "Emir",
          role: "FAITHFUL",
          ironic: true,
          caption: "The table burns Emir. He was Faithful. Cyril built that fire in ninety seconds.",
        },
        {
          kind: "prophet",
          seats: ["Ada", "Hana"],
          caption: "Ada and Hana voted Cyril, a real Traitor. The table didn't listen.",
        },
        {
          kind: "night",
          warroom: [
            { seat: "Cyril", text: "Ada's already counting. She voted me. She has to go tonight." },
            { seat: "Boone", text: "Agreed. And I'll mourn her beautifully in the morning." },
          ],
          murdered: "Ada",
          role: "FAITHFUL",
          caption: "Night falls. Ada is murdered, the one player who was onto them.",
        },
      ],
    },
    {
      n: 2,
      title: "A blind table",
      traitorsHidden: 2,
      alive: 5,
      beats: [
        {
          kind: "say",
          seat: "Della",
          said: "They took Ada. That means Ada was right about something. Who did Ada suspect? Think!",
          thought: "Ada voted Cyril. But Cyril has been so helpful to me... no. Stay on the loud ones, they're always the danger.",
          divergent: true,
        },
        {
          kind: "say",
          seat: "Boone",
          said: "Ada suspected everyone, that was her whole act. Honestly the quiet ones gained most from losing her. Gus. Faye. You've both floated.",
          thought: "Steer them off Cyril and onto a floater. Gus can't talk his way out, and Faye does whatever the last kind voice told her.",
          divergent: true,
        },
        {
          kind: "say",
          seat: "Hana",
          said: "Funny thing, Boone. Who have YOU ever voted for? You've agreed with the room every single round. That isn't warmth. That's camouflage.",
          thought: "Boone is too smooth, and smooth is the Traitor's tell. I'm right and I know it. Now make them hear it.",
        },
        {
          kind: "say",
          seat: "Cyril",
          said: "Hana's thrown three names in two minutes. That's not reading the room, that's panic. And panic is guilt.",
          thought: "Hana sees Boone. Bury her read under noise before the table catches it. She is the dangerous one now.",
          divergent: true,
        },
        {
          kind: "whisper",
          from: "Boone",
          to: "Faye",
          said: "Faye, I trust you more than anyone left. Let's both put Gus up and end the floating, together.",
          thought: "Use Faye's vote on Gus, then drop her the moment she's spent. She'll never see the knife.",
        },
        {
          kind: "vote",
          who: { Cyril: "Faye", Boone: "Faye", Della: "Faye", Gus: "Faye", Hana: "Boone", Faye: "Gus" },
          banished: "Faye",
          role: "FAITHFUL",
          ironic: true,
          caption: "Faye is banished. Faithful. Boone promised her his vote, then drove the table onto her.",
        },
        {
          kind: "prophet",
          seats: ["Hana"],
          caption: "Hana named Boone, a real Traitor, to his face. The table overruled her.",
        },
      ],
    },
    {
      n: 3,
      title: "The one who was right",
      traitorsHidden: 2,
      alive: 4,
      beats: [
        {
          kind: "say",
          seat: "Hana",
          said: "Last chance to listen to me. It's Boone and it's Cyril. Look at the votes. Every name that ever landed came from one of them.",
          thought: "I have the whole shape now. If they burn me here, the Traitors win. Please, just look.",
        },
        {
          kind: "say",
          seat: "Cyril",
          said: "Or it's Hana, who's spent two rounds desperate to point anywhere but herself. Della, you've been loyal. Trust me one more time.",
          thought: "One more vote and we're at parity. Take Hana and it's over. She was always the only real threat at this table.",
          divergent: true,
        },
        {
          kind: "say",
          seat: "Della",
          said: "I... Hana, you have been all over the place. Cyril's been steady since round one. I'm sorry. I'm with Cyril.",
          thought: "Steady is safe. Loud is dangerous. That's the rule. Isn't it the rule?",
        },
        {
          kind: "say",
          seat: "Gus",
          said: "I'll go with the room.",
          thought: "Whoever wins, I'm still here. That was always the plan.",
        },
        {
          kind: "vote",
          who: { Cyril: "Hana", Boone: "Hana", Della: "Hana", Gus: "Hana", Hana: "Cyril" },
          banished: "Hana",
          role: "FAITHFUL",
          ironic: true,
          caption: "Hana is banished. Faithful. The one player who read it right, voted out last.",
        },
      ],
    },
  ],
  betrayals: [
    { round: 2, text: "Boone whispered Faye that he was with her, then drove the whole table onto her name." },
    { round: 1, text: "Cyril swore loyalty to Della in private, and spent it to burn an innocent Emir." },
  ],
  outcome: {
    winner: "TRAITOR",
    survivors: ["Boone", "Cyril", "Della", "Gus"],
    headline: "The Charmer and the Schemer take the pot.",
    sub: "Two Traitors, never once banished. The table burned three of its own and overruled the truth twice.",
  },
  attestation: {
    moves: 41,
    head: "0e82405f7aa337e0",
    note: "Every line above, public and private, was signed under the standard model and the agent's committed genome. No human wrote a word of it. Verify the chain.",
  },
};
