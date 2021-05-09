const Time = require('./Time');
const { asyncMutativeMap, logError, logMessage } = require('./helper');

const EMOTE_TO_ROLE_ID = {
  '🟩': process.env.COMING_ROLE_ID,
  '🟦': process.env.PROBABLY_COMING_ROLE_ID,
  '🟧': process.env.PROBABLY_BUSY_ROLE_ID,
  '🟥': process.env.BUSY_ROLE_ID,
};

const EMOTE_LIST = Object.keys(EMOTE_TO_ROLE_ID);
const EMOTE_ROLE_ID_LIST = Object.values(EMOTE_TO_ROLE_ID);

async function addRoleReactionsToMessage(message) {
  try {
    await asyncMutativeMap(EMOTE_LIST, async (EMOTE) => message.react(EMOTE));
    
    const filter = (reaction) => (EMOTE_LIST.indexOf(reaction.emoji.name) !== -1);
    const config = {
      dispose: true,
      time: Time.getTimeToDate('sunday', '01:00'),
    };
    const collector = await message.createReactionCollector(filter, config);

    collector.on('collect', handleReactionAdd);
    collector.on('remove', handleReactionRemove);
    collector.on('end', handleEventEnd(message));
    
    logMessage(`Added role reaction listener to event embed ${message.id}`);
  } catch (e) {
    logError('Failed to post event. Error: ', e);
  }
}

async function handleReactionAdd(newReaction, user) {
  const message = newReaction.message;
  const member = message.guild.members.cache.get(user.id) || await message.guild.members.fetch(user.id);
  
  member.roles.add(EMOTE_TO_ROLE_ID[newReaction.emoji.name]);
  member.roles.remove(process.env.INTERESTED_ROLE_ID);
  
  for (let postedReaction of message.reactions.cache.values()) {
    if (postedReaction.emoji.name === newReaction.emoji.name || !postedReaction.users.cache.has(user.id)) continue;

    postedReaction.users.remove(user.id);
    member.roles.remove(EMOTE_TO_ROLE_ID[postedReaction.emoji.name]);
  }

  logMessage(`Collected ${newReaction.emoji.name} from ${user.tag}`);
}

const handleReactionRemove = async (removedReaction, user) => {
  const member = removedReaction.message.guild.members.cache.get(user.id) || await removedReaction.message.guild.members.fetch(user.id);
  
  member.roles.remove(EMOTE_TO_ROLE_ID[removedReaction.emoji.name]);
  member.roles.add(process.env.INTERESTED_ROLE_ID);

  logMessage(`Removed ${removedReaction.emoji.name} from ${user.tag}`);
};

async function handleEventEnd(message) {
  const allRolesList = await message.guild.roles.fetch();

  const removedMemberIds = [];
  const removeEventRoles = () => {
    const removeRoleList = roleIdList.map((roleId) => allRolesList.get(roleId));
    
    const removeAllMembersFromRole = (role) => {
      const memberIdList = [...role.members.keys()];
      removedMemberIds.push(...memberIdList);
      return asyncMutativeMap(memberList, (member) => role.members.remove(member));
    }

    return asyncMutativeMap(removeRoleList, removeAllMembersFromRole);
  }
  
  const setRemovedMembersInterested = () => {
    const interestedRole = allRolesList.get(process.env.INTERESTED_ROLE_ID);
    return asyncMutativeMap(removedMemberIds, () => interestedRole.members.add(memberId));
  }

  return () => {
    await [removeEventRoles(), setRemovedMembersInterested()];
    logMessage(`Event ended & member roles cleared.`);
  };
}

module.exports = {
  addRoleReactionsToMessage,
};