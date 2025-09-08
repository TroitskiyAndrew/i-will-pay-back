const dataService = require("../services/mongodb");
const { ObjectId } = require("mongodb");
const membersService = require("../services/membersService");

const createMember = async (req, res) => {
  try {
    const newMember = await membersService.createMember(req.body.member)
    res.status(200).send(newMember);
    return;
  } catch (error) {
    console.log(error)
    res.status(500).send(error);
    return;
  }
};

const updateMember = async (req, res) => {
  try {
    const member = req.body.member;
    const storedMember = await dataService.getDocument('members', member.id);
    member.isAdmin = storedMember.isAdmin;
    member.grantedBy = storedMember.grantedBy;
    const {id, ...rest} = member
    await membersService.updateMembers({_id: new ObjectId(id)}, {$set: rest})
    res.status(200).send(true);
    return;
  } catch (error) {
    console.log(error)
    res.status(500).send(error);
    return;
  }
};

const changeRole = async (req, res) => {
  try {
    const { user } = req.telegramData;
    const {id, isAdmin} = req.body;
    const storedMember = await dataService.getDocument('members', id);
    const userMember = await dataService.getDocumentByQuery("members", { userId: user.id });
    if(userMember.id === id || !userMember.isAdmin){
      res.status(403).send('Нельзя менять роль');
      return;
    }
    storedMember.isAdmin = isAdmin;
    storedMember.grantedBy = isAdmin ? user.id : null;
    const {id: storedId, ...rest} = storedMember;
    await membersService.updateMembers({_id: new ObjectId(id)}, {$set: rest})
    res.status(200).send(true);
    return;
  } catch (error) {
    console.log(error)
    res.status(500).send(error);
    return;
  }
};

const getMembers = async (req, res) => {
  try {
    const members = await dataService.getDocuments("members", {roomId: req.params.roomId})
    res.status(200).send(members);
    return;
  } catch (error) {
    console.log(error)
    res.status(500).send(error);
    return;
  }
};


module.exports = {
  createMember: createMember,
  updateMember: updateMember,
  changeRole: changeRole,
  getMembers: getMembers,
};
