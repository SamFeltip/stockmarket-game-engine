import type { PersonalityId } from "../../game-contracts/src";
export const roster: readonly {
    id: PersonalityId;
    name: string;
    portrait: string;
    tagline: string;
}[] = [
    {
        id: "frankie",
        name: "Frankie Faithful",
        portrait: "/static/imgs/1profile.png",
        tagline: "Trusthouse is my forte.",
    },
    {
        id: "casey",
        name: "Casey Copycat",
        portrait: "/static/imgs/2profile.png",
        tagline: "Someone here knows something.",
    },
    {
        id: "ada",
        name: "Ada Ledger",
        portrait: "/static/imgs/3profile.png",
        tagline: "Show me the cards.",
    },
    {
        id: "felix",
        name: "Felix Fox",
        portrait: "/static/imgs/4profile.png",
        tagline: "You saw what I wanted you to see.",
    },
    {
        id: "morgan",
        name: "Morgan Sharp",
        portrait: "/static/imgs/5profile.png",
        tagline: "Every move has a price.",
    },
];
