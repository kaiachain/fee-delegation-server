const { Wallet, JsonRpcProvider, parseKaia } = require('@kaiachain/ethers-ext');

// Configuration
const CONFIG = {
  // Kaia Testnet RPC
  rpcUrl: 'https://public-en-kairos.node.kaia.io',
  // rpcUrl: 'https://public-en.node.kaia.io',
  
  // Your fee delegation server
  // serverUrl: 'https://fee-delegation-kairos.kaia.io',
  // serverUrl: 'https://fee-delegation-kairos-clone.kaia.io',
  serverUrl: 'http://localhost:3000',
  // serverUrl: 'https://fee-delegation.kaia.io',
  
  // Test wallet private key (create a test wallet for this)
  privateKey: 'your_private_key',
  
  // API key (if your DApp uses API keys)
  apiKey: null,

  // Test transaction details
  to: 'wallet_address', // Replace with actual address
  amount: '0', // KAIA amount to send
  
  // Fee payer address (your server's fee payer address)
  // feePayerAddress: '0x22a4ebd6c88882f7c5907ec5a2ee269fecb5ed7a'
};

async function testFeeDelegation() {
  console.log('🚀 Testing Fee Delegation API...\n');
  
  try {
    // Connect to Kaia testnet
    const provider = new JsonRpcProvider(CONFIG.rpcUrl);
    console.log('✅ Connected to Kaia testnet');
    
    // Create wallet
    const wallet = new Wallet(CONFIG.privateKey, provider);
    console.log(`📝 Wallet address: ${wallet.address}`);
    
    // Check balance
    const balance = await wallet.getBalance();
    console.log(`💰 Wallet balance: ${balance.toString()} wei (${parseKaia(balance.toString())} KAIA)`);
    
    // Create fee-delegated transaction
    const tx = {
      from: wallet.address,
      // type: 9, // TxTypeFeeDelegatedValueTransfer
      // to: CONFIG.to,
      // value: parseKaia(CONFIG.amount),
      type: 49, // TxTypeFeeDelegatedValueTransfer
      value: 0,
      to: "0xa9eF4a5BfB21e92C06da23Ed79294DaB11F5A6df",
      data: '0xd09de08a',
      gasLimit: 100000,
      gasPrice: await provider.getGasPrice(),
      nonce: (await wallet.getTransactionCount()),
    };
    
    console.log('\n📋 Transaction details:');
    console.log(`   To: ${tx.to}`);
    console.log(`   Value: ${CONFIG.amount} KAIA`);
    console.log(`   Gas Limit: ${tx.gasLimit}`);
    console.log(`   Gas Price: ${tx.gasPrice.toString()}`);
    console.log(`   Fee Payer: ${tx.feePayer}`);
    
    // Sign transaction
    console.log('\n✏️  Signing transaction...');
    const signedTx = await wallet.signTransaction(tx);
    console.log('✅ Transaction signed');
    console.log(`📄 Signed tx: ${signedTx.substring(0, 100)}...`);
    
    // Send to fee delegation server
    console.log('\n🚀 Sending to fee delegation server...');
    
    const headers = {
      'Content-Type': 'application/json'
    };
    
    if (CONFIG.apiKey) {
      headers['Authorization'] = `Bearer ${CONFIG.apiKey}`;
    }

    console.log("signedTx", signedTx);

    
    const response = await fetch(`${CONFIG.serverUrl}/api/signAsFeePayer`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        userSignedTx: {
          raw: signedTx
        }
      })
    });
    
    const result = await response.json();
    
    console.log(`📊 Response status: ${response.status}`);
    console.log('📄 Response:');
    console.log(JSON.stringify(result, null, 2));
    
    if (result.status === true || response.status === 200) {
      console.log('\n🎉 SUCCESS! Fee delegation worked!');
      if (result.data && result.data.transactionHash) {
        console.log(`🔗 Transaction hash: ${result.data.transactionHash}`);
        console.log(`🌐 View on explorer: https://kairos.kaiascan.io/tx/${result.data.transactionHash}`);
      }
    } else {
      console.log('\n❌ FAILED! Fee delegation rejected');
      console.log(`💬 Error: ${result.message || result.data}`);
    }
    
  } catch (error) {
    console.error('\n💥 Error:', error.message);
    console.error('Stack:', error.stack);
  }
}

// Run the test
testFeeDelegation();