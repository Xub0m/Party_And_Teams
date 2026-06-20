import { system, world, Player, CommandPermissionLevel, CustomCommandOrigin, CustomCommandStatus, CustomCommandParamType } from "@minecraft/server";
import { PartyUI } from "./partyUi";
import { Party } from "./PartyManager";

// ==========================================================
// REGISTRO UNIFICADO DO COMANDO ===| /PARTY |===
// ==========================================================

system.beforeEvents.startup.subscribe((event: any) => {
    const actions = ["info", "excludeall"];
    event.customCommandRegistry.registerEnum("xubis:party_action", actions);

    const PARTY_MAIN_CMD = {
        name: "xubis:party", 
        description: "Gerencia o sistema de party e interfaces",
        permissionLevel: CommandPermissionLevel.Any, 
        mandatoryParameters: [],
        optionalParameters: [
            { type: CustomCommandParamType.Enum, name: "xubis:party_action" } 
        ]
    };

    event.customCommandRegistry.registerCommand(PARTY_MAIN_CMD, PARTY_EXECUTER);
});

/**
 * Executor centralizado do comando /party
 */
export function PARTY_EXECUTER(origin: CustomCommandOrigin, action?: string) {
    const player = origin.sourceEntity;

    if (!player || !(player instanceof Player)) {
        return {
            status: CustomCommandStatus.Failure
        };
    }

    const chosenAction = action ? action.toLowerCase() : "info";

    switch (chosenAction) {
        case "info":
            system.run(() => {
                PartyUI.openMainMenu(player);
            });
            break;

        case "excludeall":
            if (!player.hasTag("admin")) { 
                return {
                    status: CustomCommandStatus.Failure
                    // errorMessage: "Você não tem a tag 'admin' para usar esta sub-ação."
                };
            }

            system.run(() => {
                Party.excludeAllParties();
            });
            break;

        default:
            return {
                status: CustomCommandStatus.Failure
                // errorMessage: "Sub-comando inválido! Use 'info' ou 'excludeall'."
            };
    }

    return {
        status: CustomCommandStatus.Success
    };
}

// ===================== EMOTE EVENT
world.afterEvents.playerEmote.subscribe((event) => {
    PartyUI.openMainMenu(event.player);
})


// =========================== HURT BEFORE EVENT

world.beforeEvents.entityHurt.subscribe((event) => {
    const damageSource = event.damageSource
    const hurtEntity = event.hurtEntity
    const attacker = damageSource.damagingEntity

    if (hurtEntity instanceof Player && attacker instanceof Player) {
        const members = Party.getPartyMemberIds(attacker.id)

        if (members.includes(hurtEntity.id)) {
            event.cancel = true
        }
    }
})

