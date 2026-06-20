import { Player, world, system } from "@minecraft/server";
import { ActionFormData, ModalFormData } from "@minecraft/server-ui";
import { Party, MAX_PARTY_MEMBERS, PARTY_ICONS } from "./PartyManager";


const textureX = "textures/ui/redX1"

export class PartyUI {

    public static openMainMenu(player: Player) {
        const party = Party.getPartyByPlayer(player.id);

        if (party) {
            this.openPartyDashboard(player, party);
        } else {
            this.openNoPartyMenu(player);
        }
    }

    private static openNoPartyMenu(player: Player) {
        const form = new ActionFormData()
            .title({ translate: "text.party.party_system.name" })
            .body({ translate: "text.party.party_description.name" })
            .button({ translate: "text.party.party_criar_party.name" }, "textures/ui/plus")
            .button({ translate: "text.party.party_parties_publicas.name" }, "textures/ui/world_glyph_color_2x")
            .button({ translate: "text.party.party_meus_convites.name" }, "textures/ui/mail_icon");

        form.show(player).then((response) => {
            if (response.canceled) return;

            switch (response.selection) {
                case 0:
                    this.openCreatePartyModal(player);
                    break;
                case 1:
                    this.openPublicPartiesMenu(player);
                    break;
                case 2:
                    this.openInvitesMenu(player);
                    break;
            }
        });
    }

    private static openCreatePartyModal(player: Player) {
        // Criamos uma lista legível para o dropdown de ícones
        const iconOptions = PARTY_ICONS.map((_, index) => `Icon #${index + 1}`);

        const form = new ModalFormData()
            .title({ translate: "text.party.create_title.name" })
            .textField({ translate: "text.party.create_field.name" }, "Ex: Os Pro Players", { defaultValue: `${player.name}'s Party` })
            .dropdown("Escolha o Ícone da Party:", iconOptions, { defaultValueIndex: 0 }) // Seleção do ícone na criação
            .toggle({ translate: "text.party.create_toggle.name" }, { defaultValue: false });
        form.submitButton({ translate: "text.party.confirm.name" });

        form.show(player).then((response) => {
            if (response.canceled) return;
            const [name, iconIdx, isPrivate] = response.formValues as [string, number, boolean];

            if (!name || name.trim().length === 0) {
                player.sendMessage({ translate: "text.party.msg.invalid_name" });
                return;
            }

            const success = Party.createParty(player.id, player.name, name, isPrivate, iconIdx);
            if (success) {
                player.sendMessage({ translate: "text.party.msg.create_success", with: [name] });
            } else {
                player.sendMessage({ translate: "text.party.msg.create_error" });
            }
        });
    }

    private static openPublicPartiesMenu(player: Player) {
        const parties = Party.getAllPublicParties();
        const form = new ActionFormData()
            .title({ translate: "text.party.public_title.name" })
            .body(parties.length === 0 ? { translate: "text.party.public_empty.name" } : { translate: "text.party.public_select.name" });

        for (const p of parties) {
            form.button({ translate: "text.party.public_button.name", with: [p.name, p.ownerName, p.members.length.toString(), MAX_PARTY_MEMBERS.toString()] }, p.icon);
        }
        form.button({ translate: "text.party.back.name" }, "textures/ui/cancel");

        form.show(player).then((response) => {
            if (response.canceled || response.selection === parties.length) {
                this.openMainMenu(player);
                return;
            }

            const selectedParty = parties[response.selection!];
            const success = Party.joinParty(player.id, player.name, selectedParty.id);
            if (success) {
                player.sendMessage({ translate: "text.party.msg.join_success", with: [selectedParty.name] });
            } else {
                player.sendMessage({ translate: "text.party.msg.join_error" });
            }
        });
    }

    private static openInvitesMenu(player: Player) {
        const invites = Party.getInvites(player.id);
        const form = new ActionFormData()
            .title({ translate: "text.party.invites_title.name" })
            .body(invites.length === 0 ? { translate: "text.party.invites_empty.name" } : { translate: "text.party.invites_select.name" });

        for (const inv of invites) {
            form.button({ translate: "text.party.invites_button.name", with: [inv.invitedByName] });
        }
        form.button({ translate: "text.party.back.name" }, textureX);

        form.show(player).then((response) => {
            if (response.canceled || response.selection === invites.length) {
                this.openMainMenu(player);
                return;
            }

            const selectedInvite = invites[response.selection!];

            new ActionFormData()
                .title({ translate: "text.party.manage_invite_title.name" })
                .body({ translate: "text.party.manage_invite_body.name", with: [selectedInvite.invitedByName] })
                .button({ translate: "text.party.accept.name" })
                .button({ translate: "text.party.decline.name" })
                .show(player).then((subResp) => {
                    if (subResp.canceled) return;
                    if (subResp.selection === 0) {
                        if (Party.acceptInvite(player.id, player.name, selectedInvite.partyId)) {
                            player.sendMessage({ translate: "text.party.msg.invite_accepted" });
                        } else {
                            player.sendMessage({ translate: "text.party.msg.invite_accept_error" });
                        }
                    } else {
                        Party.declineInvite(player.id, selectedInvite.partyId);
                        player.sendMessage({ translate: "text.party.msg.invite_declined" });
                    }
                });
        });
    }

    private static openPartyDashboard(player: Player, party: any) {
        const isOwner = party.ownerId === player.id;

        const form = new ActionFormData()
            .title({ translate: "text.party.dashboard_menu_title.name" });

        // BOTÃO 0: Cabeçalho com o Ícone da Party. Se for o Dono, abre os Ajustes.
        const totalMembers = party.members.length;
        const infoButtonText = {
            translate: "text.party.dashboard_info_btn.name",
            with: [party.name, totalMembers.toString(), MAX_PARTY_MEMBERS.toString()]
        };
        form.button(infoButtonText, party.icon);
        form.divider();

        // Botão para convidar novos jogadores (Dono)
        if (isOwner && party.members.length < MAX_PARTY_MEMBERS) {
            form.button({ translate: "text.party.btn_invite.name" }, "textures/ui/plus");
        }

        // Renderização dos botões dos membros
        for (const member of party.members) {
            const isMemberOwner = member.id === party.ownerId;
            const isOnline = world.getAllPlayers().find((e) => e.id === member.id);

            let textName;
            let texture = "";

            if (isOnline) {
                const tagKey = isMemberOwner ? "text.party.tag_leader.name" : undefined;
                textName = { rawtext: [{ text: member.name }, { translate: tagKey }, { translate: "text.party.member_online.name" }] }
                texture = isMemberOwner ? "textures/ui/op" : "textures/ui/Ping_Green_Dark";
            } else {
                const tagKey = isMemberOwner ? "text.party.tag_leader.name" : undefined;
                textName = { rawtext: [{ text: member.name }, { translate: tagKey }, { translate: "text.party.member_offline.name" }] }
                texture = "textures/ui/Ping_Red_Dark";
            }
            form.button(textName, texture);
        }

        form.divider();

        // Botão de Sair ou Desfazer (Botão duplicado de ajustes removido daqui)
        if (!isOwner) {
            form.button({ translate: "text.party.btn_leave.name" }, textureX);
        } else {
            form.button({ translate: "text.party.btn_disband.name" }, "textures/ui/trash");
        }

        form.show(player).then((response) => {
            if (response.canceled) return;

            const selection = response.selection!;

            // Clicou no botão 0 (Cabeçalho de informações)
            if (selection === 0) {
                if (isOwner) {
                    this.openPartySettingsModal(player, party);
                } else {
                    this.openPartyDashboard(player, party);
                }
                return;
            }

            let currentIdx = 1;

            // Verifica se o botão de convite existia e foi clicado
            if (isOwner && party.members.length < MAX_PARTY_MEMBERS) {
                if (selection === currentIdx) {
                    this.openInvitePlayerModal(player);
                    return;
                }
                currentIdx++;
            }

            // Mapeia os cliques nos membros
            const memberStartIdx = currentIdx;
            const memberEndIdx = currentIdx + party.members.length;

            if (selection >= memberStartIdx && selection < memberEndIdx) {
                const targetMember = party.members[selection - memberStartIdx];

                if (!isOwner) {
                    system.run(() => { this.openPartyDashboard(player, party); });
                    return;
                }

                this.openMemberOptionsModal(player, party, targetMember);
                return;
            }

            currentIdx += party.members.length;

            // Último botão processado (Sair ou Desfazer - Índices corrigidos)
            if (isOwner) {
                Party.disbandParty(player.id);
                player.sendMessage({ translate: "text.party.msg.disbanded" });
            } else {
                Party.leaveParty(player.id);
                player.sendMessage({ translate: "text.party.msg.left" });
            }
        });
    }

    private static openPartySettingsModal(player: Player, party: any) {
        const iconOptions = PARTY_ICONS.map((_, index) => `Icon #${index + 1}`);
        const currentIconIdx = PARTY_ICONS.indexOf(party.icon) !== -1 ? PARTY_ICONS.indexOf(party.icon) : 0;

        const form = new ModalFormData()
            .title({ translate: "text.party.settings_title.name" })
            .dropdown({ translate: "text.party.settings_dropdown.name" }, iconOptions, { defaultValueIndex: currentIconIdx ,tooltip:"you can change the party icon"});

        form.divider()
        form.toggle("Xp Compartilhado", { defaultValue: true })


        form.submitButton({ translate: "text.party.confirm.name" });

        form.show(player).then((response) => {
            if (response.canceled) {
                this.openPartyDashboard(player, party);
                return;
            }

            const [newIconIdx] = response.formValues as [number];
            Party.updatePartyIcon(party.id, newIconIdx);
            player.sendMessage({ translate: "text.party.msg.icon_updated" });

            system.run(() => {
                const updated = Party.getParty(party.id);
                if (updated) this.openPartyDashboard(player, updated);
            });
        });
    }

    private static openMemberOptionsModal(player: Player, party: any, targetMember: any) {
        const isTargetMe = targetMember.id === player.id;

        if (isTargetMe) {
            system.run(() => { this.openPartyDashboard(player, party); });
            return;
        }

        const form = new ActionFormData()
            .title({ translate: "text.party.manage_title.name", with: [targetMember.name] })
            .body({ translate: "text.party.manage_body.name" })
            .button({ translate: "text.party.manage_promote.name" }, "textures/ui/op")
            .button({ translate: "text.party.manage_kick.name" }, "textures/ui/minus");

        form.show(player).then((response) => {
            if (response.canceled) {
                this.openPartyDashboard(player, party);
                return;
            }

            if (response.selection === 0) {
                party.ownerId = targetMember.id;
                party.ownerName = targetMember.name;
                Party.forceSave();

                player.sendMessage({ translate: "text.party.msg.promoted_sender", with: [targetMember.name] });
                const targetPlayer = world.getAllPlayers().find(p => p.id === targetMember.id);
                if (targetPlayer) targetPlayer.sendMessage({ translate: "text.party.msg.promoted_target" });
            }
            else if (response.selection === 1) {
                if (Party.removeMember(player.id, targetMember.id)) {
                    player.sendMessage({ translate: "text.party.msg.kicked_sender", with: [targetMember.name] });
                    const targetPlayer = world.getAllPlayers().find(p => p.id === targetMember.id);
                    if (targetPlayer) targetPlayer.sendMessage({ translate: "text.party.msg.kicked_target" });
                }
            }

            system.run(() => {
                const updatedParty = Party.getParty(party.id);
                if (updatedParty) this.openPartyDashboard(player, updatedParty);
            });
        });
    }

    private static openInvitePlayerModal(player: Player) {
        const targets = world.getAllPlayers().filter(p => p.id !== player.id && !Party.isInParty(p.id));

        if (targets.length === 0) {
            player.sendMessage({ translate: "text.party.msg.no_players" });
            return;
        }

        const form = new ModalFormData().title({ translate: "text.party.invite_title.name" });
        const names = targets.map(t => t.name);
        form.dropdown({ translate: "text.party.invite_dropdown.name" }, names);

        form.show(player).then((response) => {
            if (response.canceled) return;
            const selectedIdx = response.formValues![0] as number;
            const target = targets[selectedIdx];

            if (Party.invitePlayer(player.id, player.name, target.id)) {
                player.sendMessage({ translate: "text.party.msg.invite_sent", with: [target.name] });
                target.sendMessage({ translate: "text.party.msg.invite_received", with: [player.name] });
            } else {
                player.sendMessage({ translate: "text.party.msg.invite_pending" });
            }
        });
    }
}