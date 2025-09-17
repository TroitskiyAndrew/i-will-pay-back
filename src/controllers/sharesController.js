const dataService = require("../services/mongodb");
const sharesService = require("../services/sharesService");

const updateShare = async (req, res) => {
  try {
    const { user } = req.telegramData;
    const storedUser = await dataService.getDocumentByQuery("users", { telegramId: user.id });
    await sharesService.updateShare(req.body.share, storedUser.id)
    res.status(200).send(true);
    return;
  } catch (error) {
    console.log(error)
    res.status(500).send(error);
    return;
  }
};

const deleteShare = async (req, res) => {
  try {
    const storedShare = await dataService.getDocument("shares", req.params.shareId);
    if (!storedShare) {
      res.status(404).send('Доля не найдена');
      return;
    }
    await sharesService.deleteShare(req.params.shareId);
    res.status(200).send(true);
    return;
  } catch (error) {
    console.log(error)
    res.status(500).send(error);
    return;
  }
};

const getShares = async (req, res) => {
  try {
    const shares = await dataService.getDocuments("shares", { paymentId: req.params.paymentId })
    res.status(200).send(shares);
    return;
  } catch (error) {
    console.log(error)
    res.status(500).send(error);
    return;
  }
};


module.exports = {
  updateShare: updateShare,
  deleteShare: deleteShare,
  getShares: getShares,
};
