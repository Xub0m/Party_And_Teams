// tscripts/partySystem/partyEvents.ts
import { system as system3, world as world3, Player as Player3, CommandPermissionLevel, CustomCommandStatus, CustomCommandParamType } from "@minecraft/server";

// tscripts/partySystem/partyUi.ts
import { world as world2, system as system2 } from "@minecraft/server";
import { ActionFormData, ModalFormData } from "@minecraft/server-ui";

// tscripts/partySystem/PartyManager.ts
import { world, system, Player } from "@minecraft/server";
var MAX_PARTY_MEMBERS = 6;
var PARTY_ICONS = [
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
  "textures/ui/icons/icon_winter"
];

class PartyManager {
  static PROPERTY_KEY = "party_data";
  data;
  saveQueue = [];
  saving = false;
  isInitialized = false;
  constructor() {
    this.data = {
      parties: {},
      invites: {},
      playerPartyIndex: {}
    };
    system.run(() => {
      this.load();
      this.initEventListeners();
    });
  }
  load() {
    try {
      const raw = world.getDynamicProperty(PartyManager.PROPERTY_KEY);
      if (raw) {
        this.data = JSON.parse(raw);
      }
    } catch (e) {
      this.data = {
        parties: {},
        invites: {},
        playerPartyIndex: {}
      };
    }
    this.isInitialized = true;
  }
  save() {
    if (!this.isInitialized)
      return;
    const snapshot = JSON.stringify(this.data);
    this.saveQueue.push(snapshot);
    if (!this.saving) {
      this.processQueue();
    }
  }
  processQueue() {
    this.saving = true;
    while (this.saveQueue.length > 0) {
      const latest = this.saveQueue[this.saveQueue.length - 1];
      this.saveQueue.length = 0;
      world.setDynamicProperty(PartyManager.PROPERTY_KEY, latest);
    }
    this.saving = false;
  }
  initEventListeners() {
    world.afterEvents.entityHurt.subscribe((event) => {
      const victim = event.hurtEntity;
      const attacker = event.damageSource.damagingEntity;
      if (victim instanceof Player && attacker instanceof Player) {
        const partyAttacker = this.getPartyByPlayer(attacker.id);
        if (!partyAttacker)
          return;
        const isFriend = partyAttacker.members.some((m) => m.id === victim.id);
        if (isFriend) {
          const healthComp = victim.getComponent("minecraft:health");
          if (healthComp) {
            const maxHealth = healthComp.effectiveMax ?? 20;
            healthComp.setCurrentValue(Math.min(maxHealth, healthComp.currentValue + event.damage));
          }
        }
      }
    });
  }
  forceSave() {
    this.save();
  }
  generatePartyId() {
    return `party_${Date.now()}_${Math.floor(Math.random() * 999999)}`;
  }
  isInParty(playerId) {
    return !!this.data.playerPartyIndex[playerId];
  }
  getParty(partyId) {
    return this.data.parties[partyId];
  }
  getPartyByPlayer(playerId) {
    const partyId = this.data.playerPartyIndex[playerId];
    if (!partyId)
      return;
    return this.data.parties[partyId];
  }
  getAllParties() {
    return Object.values(this.data.parties);
  }
  getAllPublicParties() {
    return Object.values(this.data.parties).filter((party) => !party.isPrivate);
  }
  createParty(ownerId, ownerName, partyName, isPrivate, iconIndex = 0) {
    if (this.isInParty(ownerId))
      return false;
    const id = this.generatePartyId();
    const selectedIcon = PARTY_ICONS[iconIndex] || PARTY_ICONS[0];
    const party = {
      id,
      name: partyName,
      ownerId,
      ownerName,
      isPrivate,
      icon: selectedIcon,
      members: [
        { id: ownerId, name: ownerName }
      ]
    };
    this.data.parties[id] = party;
    this.data.playerPartyIndex[ownerId] = id;
    this.save();
    return true;
  }
  updatePartyIcon(partyId, iconIndex) {
    const party = this.data.parties[partyId];
    if (!party)
      return false;
    party.icon = PARTY_ICONS[iconIndex] || PARTY_ICONS[0];
    this.save();
    return true;
  }
  joinParty(playerId, playerName, partyId) {
    if (this.isInParty(playerId))
      return false;
    const party = this.data.parties[partyId];
    if (!party || party.isPrivate || party.members.length >= MAX_PARTY_MEMBERS)
      return false;
    party.members.push({
      id: playerId,
      name: playerName
    });
    this.data.playerPartyIndex[playerId] = partyId;
    this.save();
    return true;
  }
  leaveParty(playerId) {
    const party = this.getPartyByPlayer(playerId);
    if (!party)
      return false;
    party.members = party.members.filter((member) => member.id !== playerId);
    delete this.data.playerPartyIndex[playerId];
    if (party.ownerId === playerId) {
      if (party.members.length === 0) {
        delete this.data.parties[party.id];
      } else {
        party.ownerId = party.members[0].id;
        party.ownerName = party.members[0].name;
      }
    }
    this.save();
    return true;
  }
  disbandParty(ownerId) {
    const party = this.getPartyByPlayer(ownerId);
    if (!party || party.ownerId !== ownerId)
      return false;
    for (const member of party.members) {
      delete this.data.playerPartyIndex[member.id];
    }
    delete this.data.parties[party.id];
    this.save();
    return true;
  }
  removeMember(ownerId, targetId) {
    const party = this.getPartyByPlayer(ownerId);
    if (!party || party.ownerId !== ownerId || ownerId === targetId)
      return false;
    party.members = party.members.filter((member) => member.id !== targetId);
    delete this.data.playerPartyIndex[targetId];
    this.save();
    return true;
  }
  invitePlayer(ownerId, ownerName, targetId) {
    const party = this.getPartyByPlayer(ownerId);
    if (!party || party.ownerId !== ownerId)
      return false;
    this.data.invites[targetId] ??= [];
    const alreadyInvited = this.data.invites[targetId].some((invite) => invite.partyId === party.id);
    if (alreadyInvited)
      return false;
    this.data.invites[targetId].push({
      partyId: party.id,
      invitedById: ownerId,
      invitedByName: ownerName
    });
    this.save();
    return true;
  }
  getInvites(playerId) {
    return this.data.invites[playerId] ?? [];
  }
  acceptInvite(playerId, playerName, partyId) {
    if (this.isInParty(playerId))
      return false;
    const party = this.data.parties[partyId];
    if (!party || party.members.length >= MAX_PARTY_MEMBERS)
      return false;
    const invites = this.data.invites[playerId] ?? [];
    const invite = invites.find((inv) => inv.partyId === partyId);
    if (!invite)
      return false;
    party.members.push({
      id: playerId,
      name: playerName
    });
    this.data.playerPartyIndex[playerId] = partyId;
    delete this.data.invites[playerId];
    this.save();
    return true;
  }
  declineInvite(playerId, partyId) {
    const invites = this.data.invites[playerId];
    if (!invites)
      return;
    this.data.invites[playerId] = invites.filter((invite) => invite.partyId !== partyId);
    if (this.data.invites[playerId].length === 0) {
      delete this.data.invites[playerId];
    }
    this.save();
  }
  getPartyMemberIds(playerId) {
    const party = this.getPartyByPlayer(playerId);
    if (!party)
      return [];
    return party.members.map((member) => member.id);
  }
  excludeAllParties() {
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
var Party = new PartyManager;

// tscripts/partySystem/partyUi.ts
var textureX = "textures/ui/redX1";

class PartyUI {
  static openMainMenu(player) {
    const party = Party.getPartyByPlayer(player.id);
    if (party) {
      this.openPartyDashboard(player, party);
    } else {
      this.openNoPartyMenu(player);
    }
  }
  static openNoPartyMenu(player) {
    const form = new ActionFormData().title({ translate: "text.party.party_system.name" }).body({ translate: "text.party.party_description.name" }).button({ translate: "text.party.party_criar_party.name" }, "textures/ui/plus").button({ translate: "text.party.party_parties_publicas.name" }, "textures/ui/world_glyph_color_2x").button({ translate: "text.party.party_meus_convites.name" }, "textures/ui/mail_icon");
    form.show(player).then((response) => {
      if (response.canceled)
        return;
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
  static openCreatePartyModal(player) {
    const iconOptions = PARTY_ICONS.map((_, index) => `Icon #${index + 1}`);
    const form = new ModalFormData().title({ translate: "text.party.create_title.name" }).textField({ translate: "text.party.create_field.name" }, "Ex: Os Pro Players", { defaultValue: `${player.name}'s Party` }).dropdown("Escolha o Ícone da Party:", iconOptions, { defaultValueIndex: 0 }).toggle({ translate: "text.party.create_toggle.name" }, { defaultValue: false });
    form.submitButton({ translate: "text.party.confirm.name" });
    form.show(player).then((response) => {
      if (response.canceled)
        return;
      const [name, iconIdx, isPrivate] = response.formValues;
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
  static openPublicPartiesMenu(player) {
    const parties = Party.getAllPublicParties();
    const form = new ActionFormData().title({ translate: "text.party.public_title.name" }).body(parties.length === 0 ? { translate: "text.party.public_empty.name" } : { translate: "text.party.public_select.name" });
    for (const p of parties) {
      form.button({ translate: "text.party.public_button.name", with: [p.name, p.ownerName, p.members.length.toString(), MAX_PARTY_MEMBERS.toString()] }, p.icon);
    }
    form.button({ translate: "text.party.back.name" }, "textures/ui/cancel");
    form.show(player).then((response) => {
      if (response.canceled || response.selection === parties.length) {
        this.openMainMenu(player);
        return;
      }
      const selectedParty = parties[response.selection];
      const success = Party.joinParty(player.id, player.name, selectedParty.id);
      if (success) {
        player.sendMessage({ translate: "text.party.msg.join_success", with: [selectedParty.name] });
      } else {
        player.sendMessage({ translate: "text.party.msg.join_error" });
      }
    });
  }
  static openInvitesMenu(player) {
    const invites = Party.getInvites(player.id);
    const form = new ActionFormData().title({ translate: "text.party.invites_title.name" }).body(invites.length === 0 ? { translate: "text.party.invites_empty.name" } : { translate: "text.party.invites_select.name" });
    for (const inv of invites) {
      form.button({ translate: "text.party.invites_button.name", with: [inv.invitedByName] });
    }
    form.button({ translate: "text.party.back.name" }, textureX);
    form.show(player).then((response) => {
      if (response.canceled || response.selection === invites.length) {
        this.openMainMenu(player);
        return;
      }
      const selectedInvite = invites[response.selection];
      new ActionFormData().title({ translate: "text.party.manage_invite_title.name" }).body({ translate: "text.party.manage_invite_body.name", with: [selectedInvite.invitedByName] }).button({ translate: "text.party.accept.name" }).button({ translate: "text.party.decline.name" }).show(player).then((subResp) => {
        if (subResp.canceled)
          return;
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
  static openPartyDashboard(player, party) {
    const isOwner = party.ownerId === player.id;
    const form = new ActionFormData().title({ translate: "text.party.dashboard_menu_title.name" });
    const totalMembers = party.members.length;
    const infoButtonText = {
      translate: "text.party.dashboard_info_btn.name",
      with: [party.name, totalMembers.toString(), MAX_PARTY_MEMBERS.toString()]
    };
    form.button(infoButtonText, party.icon);
    form.divider();
    if (isOwner && party.members.length < MAX_PARTY_MEMBERS) {
      form.button({ translate: "text.party.btn_invite.name" }, "textures/ui/plus");
    }
    for (const member of party.members) {
      const isMemberOwner = member.id === party.ownerId;
      const isOnline = world2.getAllPlayers().find((e) => e.id === member.id);
      let textName;
      let texture = "";
      if (isOnline) {
        const tagKey = isMemberOwner ? "text.party.tag_leader.name" : undefined;
        textName = { rawtext: [{ text: member.name }, { translate: tagKey }, { translate: "text.party.member_online.name" }] };
        texture = isMemberOwner ? "textures/ui/op" : "textures/ui/Ping_Green_Dark";
      } else {
        const tagKey = isMemberOwner ? "text.party.tag_leader.name" : undefined;
        textName = { rawtext: [{ text: member.name }, { translate: tagKey }, { translate: "text.party.member_offline.name" }] };
        texture = "textures/ui/Ping_Red_Dark";
      }
      form.button(textName, texture);
    }
    form.divider();
    if (!isOwner) {
      form.button({ translate: "text.party.btn_leave.name" }, textureX);
    } else {
      form.button({ translate: "text.party.btn_disband.name" }, "textures/ui/trash");
    }
    form.show(player).then((response) => {
      if (response.canceled)
        return;
      const selection = response.selection;
      if (selection === 0) {
        if (isOwner) {
          this.openPartySettingsModal(player, party);
        } else {
          this.openPartyDashboard(player, party);
        }
        return;
      }
      let currentIdx = 1;
      if (isOwner && party.members.length < MAX_PARTY_MEMBERS) {
        if (selection === currentIdx) {
          this.openInvitePlayerModal(player);
          return;
        }
        currentIdx++;
      }
      const memberStartIdx = currentIdx;
      const memberEndIdx = currentIdx + party.members.length;
      if (selection >= memberStartIdx && selection < memberEndIdx) {
        const targetMember = party.members[selection - memberStartIdx];
        if (!isOwner) {
          system2.run(() => {
            this.openPartyDashboard(player, party);
          });
          return;
        }
        this.openMemberOptionsModal(player, party, targetMember);
        return;
      }
      currentIdx += party.members.length;
      if (isOwner) {
        Party.disbandParty(player.id);
        player.sendMessage({ translate: "text.party.msg.disbanded" });
      } else {
        Party.leaveParty(player.id);
        player.sendMessage({ translate: "text.party.msg.left" });
      }
    });
  }
  static openPartySettingsModal(player, party) {
    const iconOptions = PARTY_ICONS.map((_, index) => `Icon #${index + 1}`);
    const currentIconIdx = PARTY_ICONS.indexOf(party.icon) !== -1 ? PARTY_ICONS.indexOf(party.icon) : 0;
    const form = new ModalFormData().title({ translate: "text.party.settings_title.name" }).dropdown({ translate: "text.party.settings_dropdown.name" }, iconOptions, { defaultValueIndex: currentIconIdx, tooltip: "you can change the party icon" });
    form.divider();
    form.toggle("Xp Compartilhado", { defaultValue: true });
    form.submitButton({ translate: "text.party.confirm.name" });
    form.show(player).then((response) => {
      if (response.canceled) {
        this.openPartyDashboard(player, party);
        return;
      }
      const [newIconIdx] = response.formValues;
      Party.updatePartyIcon(party.id, newIconIdx);
      player.sendMessage({ translate: "text.party.msg.icon_updated" });
      system2.run(() => {
        const updated = Party.getParty(party.id);
        if (updated)
          this.openPartyDashboard(player, updated);
      });
    });
  }
  static openMemberOptionsModal(player, party, targetMember) {
    const isTargetMe = targetMember.id === player.id;
    if (isTargetMe) {
      system2.run(() => {
        this.openPartyDashboard(player, party);
      });
      return;
    }
    const form = new ActionFormData().title({ translate: "text.party.manage_title.name", with: [targetMember.name] }).body({ translate: "text.party.manage_body.name" }).button({ translate: "text.party.manage_promote.name" }, "textures/ui/op").button({ translate: "text.party.manage_kick.name" }, "textures/ui/minus");
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
        const targetPlayer = world2.getAllPlayers().find((p) => p.id === targetMember.id);
        if (targetPlayer)
          targetPlayer.sendMessage({ translate: "text.party.msg.promoted_target" });
      } else if (response.selection === 1) {
        if (Party.removeMember(player.id, targetMember.id)) {
          player.sendMessage({ translate: "text.party.msg.kicked_sender", with: [targetMember.name] });
          const targetPlayer = world2.getAllPlayers().find((p) => p.id === targetMember.id);
          if (targetPlayer)
            targetPlayer.sendMessage({ translate: "text.party.msg.kicked_target" });
        }
      }
      system2.run(() => {
        const updatedParty = Party.getParty(party.id);
        if (updatedParty)
          this.openPartyDashboard(player, updatedParty);
      });
    });
  }
  static openInvitePlayerModal(player) {
    const targets = world2.getAllPlayers().filter((p) => p.id !== player.id && !Party.isInParty(p.id));
    if (targets.length === 0) {
      player.sendMessage({ translate: "text.party.msg.no_players" });
      return;
    }
    const form = new ModalFormData().title({ translate: "text.party.invite_title.name" });
    const names = targets.map((t) => t.name);
    form.dropdown({ translate: "text.party.invite_dropdown.name" }, names);
    form.show(player).then((response) => {
      if (response.canceled)
        return;
      const selectedIdx = response.formValues[0];
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

// tscripts/partySystem/partyEvents.ts
system3.beforeEvents.startup.subscribe((event) => {
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
function PARTY_EXECUTER(origin, action) {
  const player = origin.sourceEntity;
  if (!player || !(player instanceof Player3)) {
    return {
      status: CustomCommandStatus.Failure
    };
  }
  const chosenAction = action ? action.toLowerCase() : "info";
  switch (chosenAction) {
    case "info":
      system3.run(() => {
        PartyUI.openMainMenu(player);
      });
      break;
    case "excludeall":
      if (!player.hasTag("admin")) {
        return {
          status: CustomCommandStatus.Failure
        };
      }
      system3.run(() => {
        Party.excludeAllParties();
      });
      break;
    default:
      return {
        status: CustomCommandStatus.Failure
      };
  }
  return {
    status: CustomCommandStatus.Success
  };
}
world3.beforeEvents.entityHurt.subscribe((event) => {
  const damageSource = event.damageSource;
  const hurtEntity = event.hurtEntity;
  const attacker = damageSource.damagingEntity;
  if (hurtEntity instanceof Player3 && attacker instanceof Player3) {
    const members = Party.getPartyMemberIds(attacker.id);
    if (members.includes(hurtEntity.id)) {
      event.cancel = true;
    }
  }
});
