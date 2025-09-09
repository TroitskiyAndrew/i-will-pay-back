const dataService = require("../services/mongodb");
const sharesService = require("../services/sharesService");

const createShare = async (req, res) => {
  try {
    const { user } = req.telegramData;
    const {share} = req.body;
    const payment = dataService.getDocument("payments", share.paymentId)
    if(share.userId === user.id) {
      share.confirmedByUser = true;
    } else {
      share.confirmedByUser = false;
    }
    if(payment.payer === user.id && (share.share !== null || share.amount !== null)) {
      share.confirmedByPayer = true;
    } else {
      share.confirmedByPayer = false;
    }
    const newShare = await sharesService.createShare(share);
    res.status(200).send(newShare);
    return;
  } catch (error) {
    console.log(error)
    res.status(500).send(error);
    return;
  }
};

const updateShare = async (req, res) => {
  try {
    const { user } = req.telegramData;
    const {share} = req.body;
    const payment = await dataService.getDocument("payments", share.paymentId);
    if(share.userId === user.id) {
      share.confirmedByUser = true;
    } else {
      share.confirmedByUser = false;
    }
    if(payment.payer === user.id) {
      share.confirmedByPayer = true;
    } else {
      share.confirmedByPayer = false;
    }
    const {id, ...rest} = share;
    await sharesService.updateShare(share, payment.roomId)
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
    const { user } = req.telegramData;
    const storedShare = await dataService.getDocument("shares", req.params.shareId);
    if(!storedShare) {
      res.status(404).send('Доля не найдена');
      return;
    }
    const payment = await dataService.getDocument("payments", storedShare.paymentId);
    if(payment.payer !== user.id){
      res.status(403).send('Нельзя удалять доли из чужого платежа');
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
    const shares = await dataService.getDocuments("shares", {paymentId: req.params.paymentId})
    res.status(200).send(shares);
    return;
  } catch (error) {
    console.log(error)
    res.status(500).send(error);
    return;
  }
};


module.exports = {
  createShare: createShare,
  updateShare: updateShare,
  deleteShare: deleteShare,
  getShares: getShares,
};
