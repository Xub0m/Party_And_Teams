import { world, system, Player } from "@minecraft/server"

export const MAX_PARTY_MEMBERS = 6

// Lista com os 11 caminhos de ícones prontos para você completar
export const PARTY_ICONS = [
    "textures/ui/icons/icon_adventuretime",
    "textures/ui/icons/icon_angrybirds",
    "textures/ui/icons/icon_batman",
    "textures/ui/icons/icon_ben10",
    "textures/ui/icons/icon_best",
    "textures/ui/icons/icon_blackfriday",
    "textures/ui/icons/icon_deals",
    "textures/ui/icons/icon_fall",
    "textures/ui/icons/icon_frozen",
    "textures/ui/icons/icon_httyd",
    "textures/ui/icons/icon_iceage",
    "textures/ui/icons/icon_jurassic",
    "textures/ui/icons/icon_lightyear",
    "textures/ui/icons/icon_mashupbrush",
    "textures/ui/icons/icon_mashuphanger",
    "textures/ui/icons/icon_mashupworld",
    "textures/ui/icons/icon_minions",
    "textures/ui/icons/icon_multiplayer",
    "textures/ui/icons/icon_new",
    "textures/ui/icons/icon_nightmarebeforechristmas",
    "textures/ui/icons/icon_piratesofthecaribbean",
    "textures/ui/icons/icon_sonic",
    "textures/ui/icons/icon_spongebobsquarepants",
    "textures/ui/icons/icon_spring",
    "textures/ui/icons/icon_staffpicks",
    "textures/ui/icons/icon_starwars",
    "textures/ui/icons/icon_summer",
    "textures/ui/icons/icon_toystory",
    "textures/ui/icons/icon_trailer",
    "textures/ui/icons/icon_trending",
    "textures/ui/icons/icon_wdwmagickingdomadventure",
    "textures/ui/icons/icon_winter",
];

export interface PartyMember {
    id: string
    name: string
}

export interface PartyInvite {
    partyId: string
    invitedById: string
    invitedByName: string
}

export interface Party {
    id: string
    name: string
    ownerId: string
    ownerName: string
    isPrivate: boolean
    icon: string; // Nova propriedade adicionada para armazenar a textura selecionada
    members: PartyMember[]
    // createdAt: number
}

interface PartyData {
    parties: Record<string, Party>
    invites: Record<string, PartyInvite[]>
    playerPartyIndex: Record<string, string>
}

export class PartyManager {
    private static readonly PROPERTY_KEY = "party_data"
    private data!: PartyData
    private saveQueue: string[] = []
    private saving = false
    private isInitialized = false

    constructor() {
        this.data = {
            parties: {},
            invites: {},
            playerPartyIndex: {}
        }

        system.run(() => {
            this.load()
            this.initEventListeners()
        })
    }

    private load(): void {
        try {
            const raw = world.getDynamicProperty(PartyManager.PROPERTY_KEY)
            if (raw) {
                this.data = JSON.parse(raw as string)
            }
        } catch (e) {
            this.data = {
                parties: {},
                invites: {},
                playerPartyIndex: {}
            }
        }
        this.isInitialized = true
    }

    private save() {
        if (!this.isInitialized) return

        const snapshot = JSON.stringify(this.data)
        this.saveQueue.push(snapshot)

        if (!this.saving) {
            this.processQueue()
        }
    }

    private processQueue() {
        this.saving = true

        while (this.saveQueue.length > 0) {
            const latest = this.saveQueue[this.saveQueue.length - 1]
            this.saveQueue.length = 0

            world.setDynamicProperty(
                PartyManager.PROPERTY_KEY,
                latest
            )
        }

        this.saving = false
    }

    private initEventListeners() {
        world.afterEvents.entityHurt.subscribe((event) => {
            const victim = event.hurtEntity
            const attacker = event.damageSource.damagingEntity

            if (victim instanceof Player && attacker instanceof Player) {
                const partyAttacker = this.getPartyByPlayer(attacker.id)
                if (!partyAttacker) return

                const isFriend = partyAttacker.members.some(m => m.id === victim.id)
                if (isFriend) {
                    const healthComp = victim.getComponent("minecraft:health")
                    if (healthComp) {
                        // @ts-ignore
                        const maxHealth = healthComp.effectiveMax ?? 20
                        // @ts-ignore
                        healthComp.setCurrentValue(Math.min(maxHealth, healthComp.currentValue + event.damage))
                    }
                }
            }
        })
    }

    public forceSave() {
        this.save()
    }

    private generatePartyId() {
        return `party_${Date.now()}_${Math.floor(Math.random() * 999999)}`
    }

    public isInParty(playerId: string) {
        return !!this.data.playerPartyIndex[playerId]
    }

    public getParty(partyId: string) {
        return this.data.parties[partyId]
    }

    public getPartyByPlayer(playerId: string) {
        const partyId = this.data.playerPartyIndex[playerId]
        if (!partyId) return undefined
        return this.data.parties[partyId]
    }

    public getAllParties() {
        return Object.values(this.data.parties)
    }

    public getAllPublicParties() {
        return Object.values(this.data.parties).filter(
            party => !party.isPrivate
        )
    }

    public createParty(ownerId: string, ownerName: string, partyName: string, isPrivate: boolean, iconIndex: number = 0) {
        if (this.isInParty(ownerId)) return false

        const id = this.generatePartyId()
        const selectedIcon = PARTY_ICONS[iconIndex] || PARTY_ICONS[0];

        const party: Party = {
            id,
            name: partyName,
            ownerId,
            ownerName,
            isPrivate,
            icon: selectedIcon,
            // createdAt: Date.now(),
            members: [
                { id: ownerId, name: ownerName }
            ]
        }

        this.data.parties[id] = party
        this.data.playerPartyIndex[ownerId] = id
        this.save()
        return true
    }

    public updatePartyIcon(partyId: string, iconIndex: number) {
        const party = this.data.parties[partyId];
        if (!party) return false;

        party.icon = PARTY_ICONS[iconIndex] || PARTY_ICONS[0];
        this.save();
        return true;
    }

    public joinParty(playerId: string, playerName: string, partyId: string) {
        if (this.isInParty(playerId)) return false

        const party = this.data.parties[partyId]
        if (!party || party.isPrivate || party.members.length >= MAX_PARTY_MEMBERS) return false

        party.members.push({
            id: playerId,
            name: playerName
        })

        this.data.playerPartyIndex[playerId] = partyId
        this.save()
        return true
    }

    public leaveParty(playerId: string) {
        const party = this.getPartyByPlayer(playerId)
        if (!party) return false

        party.members = party.members.filter(
            member => member.id !== playerId
        )

        delete this.data.playerPartyIndex[playerId]

        if (party.ownerId === playerId) {
            if (party.members.length === 0) {
                delete this.data.parties[party.id]
            } else {
                party.ownerId = party.members[0].id
                party.ownerName = party.members[0].name
            }
        }

        this.save()
        return true
    }

    public disbandParty(ownerId: string) {
        const party = this.getPartyByPlayer(ownerId)
        if (!party || party.ownerId !== ownerId) return false

        for (const member of party.members) {
            delete this.data.playerPartyIndex[member.id]
        }

        delete this.data.parties[party.id]
        this.save()
        return true
    }

    public removeMember(ownerId: string, targetId: string) {
        const party = this.getPartyByPlayer(ownerId)
        if (!party || party.ownerId !== ownerId || ownerId === targetId) return false

        party.members = party.members.filter(
            member => member.id !== targetId
        )

        delete this.data.playerPartyIndex[targetId]
        this.save()
        return true
    }

    public invitePlayer(
        ownerId: string,
        ownerName: string,
        targetId: string
    ) {
        const party = this.getPartyByPlayer(ownerId)
        if (!party || party.ownerId !== ownerId) return false

        this.data.invites[targetId] ??= []

        const alreadyInvited = this.data.invites[targetId].some(
            invite => invite.partyId === party.id
        )

        if (alreadyInvited) return false

        this.data.invites[targetId].push({
            partyId: party.id,
            invitedById: ownerId,
            invitedByName: ownerName
        })

        this.save()
        return true
    }

    public getInvites(playerId: string) {
        return this.data.invites[playerId] ?? []
    }

    public acceptInvite(
        playerId: string,
        playerName: string,
        partyId: string
    ) {
        if (this.isInParty(playerId)) return false

        const party = this.data.parties[partyId]
        if (!party || party.members.length >= MAX_PARTY_MEMBERS) return false

        const invites = this.data.invites[playerId] ?? []
        const invite = invites.find(inv => inv.partyId === partyId)
        if (!invite) return false

        party.members.push({
            id: playerId,
            name: playerName
        })

        this.data.playerPartyIndex[playerId] = partyId
        delete this.data.invites[playerId]
        this.save()
        return true
    }

    public declineInvite(playerId: string, partyId: string) {
        const invites = this.data.invites[playerId]
        if (!invites) return

        this.data.invites[playerId] = invites.filter(
            invite => invite.partyId !== partyId
        )

        if (this.data.invites[playerId].length === 0) {
            delete this.data.invites[playerId]
        }

        this.save()
    }

    public getPartyMemberIds(playerId: string): string[] {
        const party = this.getPartyByPlayer(playerId);
        if (!party) return [];
        return party.members.map(member => member.id);
    }

    public excludeAllParties() {
        this.data = {
            parties: {},
            invites: {},
            playerPartyIndex: {}
        };
        world.setDynamicProperty(PartyManager.PROPERTY_KEY, undefined);
        this.save();
        world.sendMessage("§c[PartySystem] Todas as parties foram deletadas pelo Administrador!");
    }
}

export const Party = new PartyManager()