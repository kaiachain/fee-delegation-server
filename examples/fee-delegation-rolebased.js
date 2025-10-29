// Initial Account (100 KAIA) - Pub0, Priv0

// ROLEBASED Wallet - Pub0 (Balance 100 KAIA)
// - Transaction ROLE - Priv0 -> Can perform Transaction. transfer 50 KAIA to others, smart contract interaction.
// - Feepayer role  = Priv1 (consumes Pub0 balance in the form of free)
// - account update role - Priv0



// Priv1 -> Pub1 (0 KAIA)

// 1. Priv1 Perform a signature(feedelegationtype) behalf of user (inputs from user)
// 2. Priv1 (Pub0) -> acting as feepayerrole -> sendtransactionasfeepayer(senderTxHashRLP)



const { Wallet, TxType, parseKlay , parseTransaction, JsonRpcProvider} = require("@kaiachain/ethers-ext/v6");
const senderAddr = "0x8BF1c37c9d4fFEdA9d0AA99F6944646663f0b142";
const senderRolebasedAddr = "0x32DFeCe547aAB7D7a9caE5a52859bB5E281F711e";
const senderPriv =
  "private_key_0";
const recieverAddr = "0x389194bE3adaD500109f236cE7ecd3B89C502137";

//testnet
const feePayerServer = "https://fee-delegation-kairos.kaia.io";

async function main() {
  const provider = new JsonRpcProvider(
    // "https://public-en.node.kaia.io"
    "https://public-en-kairos.node.kaia.io"
  );
  const senderWallet = new Wallet(senderPriv, provider); // Priv1 Standalone -> No association with Pub0 (signtransaction)
  const senderRoleBasedWallet = new Wallet(senderRolebasedAddr, senderPriv, provider); // sendtransactionasfeepayer

  // value transfer
  let tx = {
    type: TxType.FeeDelegatedValueTransfer,
    to: recieverAddr,
    value: parseKlay("0"),
    from: senderAddr,
    gasLimit: 40000,
  };


  // Populate transaction
  tx = await senderWallet.populateTransaction(tx);
  console.log(tx);

  // 1. No assodicated with Rolebasedwallet. standalone fds admin .
  let senderTxHashRLP = await senderWallet.signTransaction(tx);
  console.log(senderTxHashRLP)


  // 2. FDS admin but associated with Rolebasedwallet.
  let feePayerWallet = senderRoleBasedWallet;
  const sentTx = await feePayerWallet.sendTransactionAsFeePayer(senderTxHashRLP);
  console.log("sentTx", sentTx);

  const rc = await sentTx.wait();
  console.log("receipt", rc);

}


main();