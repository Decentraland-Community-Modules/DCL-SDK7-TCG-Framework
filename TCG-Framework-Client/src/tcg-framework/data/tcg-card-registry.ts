import { Entity, GltfContainer, GltfContainerLoadingState, LoadingState, Transform, engine } from "@dcl/sdk/ecs";
import { Dictionary, List } from "../../utilities/collections";
import { CARD_DATA_ID, CARD_TYPE, CardData, CardDataObject} from "./tcg-card-data";
import { CardTextureData, CardTextureDataObject } from "./tcg-card-texture-data";
import { CARD_FACTION_TYPE, CardFactionData, CardFactionDataObject } from "./tcg-faction-data";
import { CardFactionTextureData, CardFactionTextureDataObject } from "./tcg-faction-texture-data";

/*      TRADING CARD GAME - CARD REGISTRY
    contains access to all cards, with a variety of access methods. card entries
    contain the max number of instances each card can have, per source (level/contract).
*/

/** defines every unlock type */
export enum CARD_UNLOCK_TYPE {
    LEVEL,
    CONTRACT
}
/** linkage for a single faction's data in the game */
export class FactionEntry {
    /** faction's uid */
    private id:CARD_FACTION_TYPE; 
    public get ID() { return this.id; }
    /** faction's data position */
    private position:number;
    public get Position():number { return this.Position; }
    /** returns the faction's data component */
    public get DataDef():CardFactionDataObject { return CardFactionData[this.position]; }

    /** prepares card data entry for use */
    constructor(pos:number, id:CARD_FACTION_TYPE) {
        this.position = pos;
        this.id = id;
    }
}
/* linkage for a single card's data in the game */
export class CardEntry {
    /** card's uid */
    private id:CARD_DATA_ID; 
    public get ID() { return this.id; }
    /** card's data position */
    private position:number;
    public get Position(): number { return this.Position; }
    /** returns the card's data component */
    public get DataDef(): CardDataObject { return CardData[this.position]; }

    /** array containing all counts per unlock type */
    private count:number[] = [];
    /** provides the total number of allowed cards for the player's deck */
    public get CountAllowed():number {
        //process all 
        let value:number = 0;
        for (var i:number = 0; i<this.count.length; i++) {
            value += this.count[i];
        }
        return value;
    }
    
    /** prepares card data entry for use */
    constructor(pos:number, id:CARD_DATA_ID) {
        this.position = pos;
        this.id = id;
        //populate count array
        Object.keys(CARD_UNLOCK_TYPE).forEach(() => { this.count.push(0); });
    }
    
    /** clears all counts for the given type */
    public ClearCount(type:CARD_UNLOCK_TYPE) {
        this.count[type] = 0;
    } 

    /** increases the count of a given type */
    public AddCount(type:CARD_UNLOCK_TYPE, value:number) {
        this.count[type] += value;
    }
}
/* manages all entries for card, sorted per type and allowed counts per deck */
export class CardDataRegistry {
    /** when true debug logs are generated (toggle off when you deploy) */
    static IsDebugging:boolean = false;
    /** hard-coded tag for module, helps log search functionality */
    static debugTag:string = "TCG Card Registry: ";

    /** access pocketing */
    private static instance: undefined | CardDataRegistry;
    public static get Instance(): CardDataRegistry {
        //ensure instance is set
        if (CardDataRegistry.instance === undefined) {
            CardDataRegistry.instance = new CardDataRegistry();
        }
        return CardDataRegistry.instance;
    }

    //sheet registries
    //  faction
    private factionTextureRegistry: Dictionary<CardFactionTextureDataObject>;
    //  card
    private cardTextureRegistry: Dictionary<CardTextureDataObject>;

    //data registries
    //  faction 
    //      to ALL registered data (unsorted)
    private factionRegistryAll: List<FactionEntry>;
    //      indexes of factions (positions in data)
    private factionRegistryViaID: Dictionary<FactionEntry>;
    //  card
    //      to ALL registered data (unsorted)
    private cardRegistryAll: List<CardEntry>;
    //      id as key 
    private cardRegistryViaID: Dictionary<CardEntry>;
    //      data split via type (spell, character, field)
    private cardRegistryViaType: Dictionary<List<CardEntry>>;
    //      data split via faction
    private cardRegistryViaFaction: Dictionary<List<CardEntry>>;
    
    //overhead count functions (used to easy access for iterators)
    /** returns number of card factions */
    public static CardFactionCount() { return CardDataRegistry.Instance.factionRegistryAll.size(); }
    
    /** prepares instanced registry for use */
    public constructor() {
        if (CardDataRegistry.IsDebugging) console.log(CardDataRegistry.debugTag+"initializing...");

        //initialize texture collections
        //  factions
        this.factionTextureRegistry = new Dictionary<CardFactionTextureDataObject>();
        for(let i:number=0; i<CardFactionTextureData.length; i++) {
            this.factionTextureRegistry.addItem(CardFactionTextureData[i].id.toString(), CardFactionTextureData[i]);
        }
        //  cards
        this.cardTextureRegistry = new Dictionary<CardTextureDataObject>();
        for(let i:number=0; i<CardTextureData.length; i++) {
            this.cardTextureRegistry.addItem(CardTextureData[i].id.toString(), CardTextureData[i]);
        }

        //initialize faction collections
        this.factionRegistryAll = new List<FactionEntry>();
        this.factionRegistryViaID = new Dictionary<FactionEntry>();
        //initialize card collections
        this.cardRegistryAll = new List<CardEntry>();
        this.cardRegistryViaID = new Dictionary<CardEntry>();
        this.cardRegistryViaType = new Dictionary<List<CardEntry>>();
        this.cardRegistryViaFaction = new Dictionary<List<CardEntry>>();
        //initialize sort by faction sorting collection
        for(let i:number=0; i<CardFactionData.length; i++) {
            const entry = new FactionEntry(i, CardFactionData[i].id);
            this.factionRegistryAll.addItem(entry);
            this.factionRegistryViaID.addItem(CardFactionData[i].id.toString(), entry);
            this.cardRegistryViaFaction.addItem(CardFactionData[i].id.toString(), new List<CardEntry>());
        }

        //populate registry collections
        //  process every type
        Object.keys(CARD_TYPE).forEach((key, value) => {
            //add type listing
            if (CardDataRegistry.IsDebugging) console.log(CardDataRegistry.debugTag+"creating type {key=" + key+", value="+value+"}");
            this.cardRegistryViaType.addItem(key.toString(), new List<CardEntry>());
        });
        //  process every def
        for (var i: number = 0; i < CardData.length; i++) {
            //prepare entry
            const entry = new CardEntry(i, CardData[i].id);
            if (CardDataRegistry.IsDebugging) console.log(CardDataRegistry.debugTag+"creating entry=" + i
                + ", type=" + CardData[i].type.toString() + ", faction=" + CardData[i].faction.toString());
            //add to registry
            this.cardRegistryAll.addItem(entry);
            this.cardRegistryViaID.addItem(CardData[i].id.toString(), entry);
            this.cardRegistryViaType.getItem(CardData[i].type.toString()).addItem(entry);
            this.cardRegistryViaFaction.getItem(CardData[i].faction.toString()).addItem(entry);
        }

        if (CardDataRegistry.IsDebugging) console.log(CardDataRegistry.debugTag+"initialized, total count=" + this.cardRegistryAll.size());
    }

    public PrewarmIndex:number = 0;
    public PrewarmEntity:Entity = engine.addEntity();
    /** begins card asset pre-warming, cycling through each provided model */
    public async PrewarmAssetStart() {
        //prepare holder entity
        Transform.create(this.PrewarmEntity, {
            position: {x:8,y:-2,z:8},
            scale: {x:0,y:0,z:0}
        });

        //process every model
        GltfContainer.createOrReplace(this.PrewarmEntity, {src: CardData[this.PrewarmIndex].objPath});

        //add processing system
        engine.addSystem(this.PrewarmAssetCheck);
    }
    
    /** halts card asset pre-warming */
    public PrewarmAssetFinish() {
        engine.removeEntity(this.PrewarmEntity);
        engine.removeSystem(this.PrewarmAssetCheck);
    }

    /** attempts to prewarm all card assets, ensuring they are made available for use upon request without having to wait on a first-load */
    private PrewarmAssetCheck(deltaTime:number) {
        //get loading state
        const loadingState = GltfContainerLoadingState.getOrNull(CardDataRegistry.Instance.PrewarmEntity);
        if (!loadingState) return
        //process loading state (check for load completion)
        switch (loadingState.currentState) {
            case LoadingState.FINISHED:
                //console.log("asset index="+CardDataRegistry.Instance.PrewarmIndex+" finished loading successfully");
                //push next index
                CardDataRegistry.Instance.PrewarmIndex++;
                //if prewarm finished, halt processing
                if(CardDataRegistry.Instance.PrewarmIndex >= CardData.length) {
                    CardDataRegistry.Instance.PrewarmAssetFinish();
                }
                //if not, load next asset 
                else {
                    GltfContainer.createOrReplace(CardDataRegistry.Instance.PrewarmEntity, {src: CardData[CardDataRegistry.Instance.PrewarmIndex].objPath});
                }
            break
            case LoadingState.FINISHED_WITH_ERROR:
                //console.log("asset index="+CardDataRegistry.Instance.PrewarmIndex+" finished loading with errors (check model path & file validity)");
            break
            case LoadingState.UNKNOWN:
                //console.log("<ERROR> failed to get load state (likely invalid model path)");
            break
        }
    }

    /** resets all allowed card counts for a type */
    public ResetAllowedCount(type:CARD_UNLOCK_TYPE) {
        //process every entry
        for (var i: number = 0; i < this.cardRegistryAll.size(); i++) {
            this.cardRegistryAll.getItem(i).ClearCount(type);
        }
    }

    //### FACTIONS
    /** returns faction sheet */
    public CallbackGetFactionTexture(faction: CARD_FACTION_TYPE): CardFactionTextureDataObject { return CardDataRegistry.Instance.GetFactionTexture(faction); }
    public GetFactionTexture(faction: CARD_FACTION_TYPE): CardFactionTextureDataObject { return this.factionTextureRegistry.getItem(this.GetFaction(faction).sheetData.id.toString()); }
    /** returns faction data object */
    public CallbackGetFaction(faction: CARD_FACTION_TYPE): CardFactionDataObject { return CardDataRegistry.Instance.GetFaction(faction); }
    public GetFaction(faction: CARD_FACTION_TYPE): CardFactionDataObject { return this.factionRegistryViaID.getItem(faction.toString()).DataDef; }
    
    //### CARDS
    /** returns card sheet index */
    public CallbackGetCardTexture(id: CARD_DATA_ID): CardTextureDataObject { return CardDataRegistry.Instance.GetCardTexture(id); }
    public GetCardTexture(id:CARD_DATA_ID): CardTextureDataObject { return this.cardTextureRegistry.getItem(this.GetEntryByID(id).DataDef.sheetData.id.toString()); }
    /** returns card entry at given position */
    public CallbackGetEntryByPos(index: number): CardEntry { return CardDataRegistry.Instance.GetEntryByPos(index); }
    public GetEntryByPos(index: number): CardEntry { return this.cardRegistryAll.getItem(index); }
    /** returns entry of given id */
    public CallbackGetEntryByID(id: CARD_DATA_ID): CardEntry { return CardDataRegistry.Instance.GetEntryByID(id); }
    public GetEntryByID(id: CARD_DATA_ID): CardEntry { return this.cardRegistryViaID.getItem(id.toString()); }
    /** returns entry of given faction and position within the faction listing*/
    public CallbackGetEntryByFaction(faction: CARD_FACTION_TYPE, index: number): CardEntry { return CardDataRegistry.Instance.GetEntryByFaction(faction, index); }
    public GetEntryByFaction(faction: CARD_FACTION_TYPE, index: number): CardEntry { return this.cardRegistryViaFaction.getItem(faction.toString()).getItem(index); }
    /** returns entry of given rarity and position */
    public CallbackGetEntryByType(type: CARD_FACTION_TYPE, index: number): CardEntry { return CardDataRegistry.Instance.GetEntryByType(type, index); }
    public GetEntryByType(type: CARD_FACTION_TYPE, index: number): CardEntry { return this.cardRegistryViaType.getItem(type.toString()).getItem(index); }
}