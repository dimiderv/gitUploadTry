/*
 * Copyright IBM Corp. All Rights Reserved.
 *
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict';

const { Gateway, Wallets } = require('fabric-network');
const FabricCAServices = require('fabric-ca-client');
const path = require('path');
const { buildCAClient, registerAndEnrollUser, enrollAdmin, registerAndEnrollCreator, registerAndEnrollFarmer, registerAndEnrollRetailer } = require('../../test-application/javascript/CAUtil.js');
const { buildCCPOrg1, buildWallet, buildCCPOrg2 } = require('../../test-application/javascript/AppUtil.js');

const channelName = 'mychannel';
const chaincodeName = 'try';
const mspOrg1 = 'Org1MSP';
const mspOrg2 = 'Org2MSP';
const walletPath1 = path.join(__dirname, 'wallet/org1');
const walletPath2 = path.join(__dirname, 'wallet/org2');

let org1UserId = 'Farmer';
let org2UserId = 'Retailer';

/*----------------------------------code for phase 2---------------------------------*/

const memberAssetCollectionName = 'assetCollection';
const org1PrivateCollectionName = 'Org1MSPPrivateCollection';
const org2PrivateCollectionName = 'Org2MSPPrivateCollection';

function doFail(msgString) {
    console.error(`${RED}\t${msgString}${RESET}`);
    process.exit(1);
}

function verifyAssetData(org, resultBuffer, expectedId, color, size, ownerUserId, appraisedValue) {

    let asset;
    if (resultBuffer) {
        asset = JSON.parse(resultBuffer.toString('utf8'));
    } else {
        doFail('Failed to read asset');
    }
    console.log(`*** verify asset data for: ${expectedId}`);
    if (!asset) {
        doFail('Received empty asset');
    }
    if (expectedId !== asset.assetID) {
        doFail(`recieved asset ${asset.assetID} , but expected ${expectedId}`);
    }
    if (asset.color !== color) {
        doFail(`asset ${asset.assetID} has color of ${asset.color}, expected value ${color}`);
    }
    if (asset.size !== size) {
        doFail(`Failed size check - asset ${asset.assetID} has size of ${asset.size}, expected value ${size}`);
    }

    if (asset.owner.includes(ownerUserId)) {
        console.log(`\tasset ${asset.assetID} owner: ${asset.owner}`);
    } else {
        doFail(`Failed owner check from ${org} - asset ${asset.assetID} owned by ${asset.owner}, expected userId ${ownerUserId}`);
    }
    if (appraisedValue) {
        if (asset.appraisedValue !== appraisedValue) {
            doFail(`Failed appraised value check from ${org} - asset ${asset.assetID} has appraised value of ${asset.appraisedValue}, expected value ${appraisedValue}`);
        }
    }
}

function verifyAssetPrivateDetails(resultBuffer, expectedId, secret) {
    let assetPD;
    if (resultBuffer) {
        assetPD = JSON.parse(resultBuffer.toString('utf8'));
    } else {
        doFail('Failed to read asset private details');
    }
    console.log(`*** verify private details: ${expectedId}`);
    if (!assetPD) {
        doFail('Received empty data');
    }
    if (expectedId !== assetPD.assetID) {
        doFail(`recieved ${assetPD.assetID} , but expected ${expectedId}`);
    }

    if (secret) {
        if (assetPD.secret !== secret) {
            doFail(`Failed appraised value check - asset ${assetPD.assetID} has secret value of ${assetPD.secret}, expected value ${secret}`);
        }
    }
}

//-----------------------------end of code------------------------
function makeid(length) {
    var result           = '';
    var characters       = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    var charactersLength = characters.length;
    for ( var i = 0; i < length; i++ ) {
      result += characters.charAt(Math.floor(Math.random() * 
 charactersLength));
   }
   return result;
}

let temp=makeid(1);
org1UserId+=temp;
org2UserId+=temp;

function prettyJSONString(inputString) {
	return JSON.stringify(JSON.parse(inputString), null, 2);
}



async function initContractFromOrg1Identity(org1UserId) {
    console.log('\n--> Fabric client user & Gateway init: Using Org1 identity to Org1 Peer');
    // build an in memory object with the network configuration (also known as a connection profile)
    const ccpOrg1 = buildCCPOrg1();

    // build an instance of the fabric ca services client based on
    // the information in the network configuration
    const caOrg1Client = buildCAClient(FabricCAServices, ccpOrg1, 'ca.org1.example.com');

    // setup the wallet to cache the credentials of the application user, on the app server locally
    const walletPathOrg1 = path.join(__dirname, 'wallet/org1');
    const walletOrg1 = await buildWallet(Wallets, walletPathOrg1);

    // in a real application this would be done on an administrative flow, and only once
    // stores admin identity in local wallet, if needed
    await enrollAdmin(caOrg1Client, walletOrg1, mspOrg1);
    // register & enroll application user with CA, which is used as client identify to make chaincode calls
    // and stores app user identity in local wallet
    // In a real application this would be done only when a new user was required to be added
    // and would be part of an administrative flow
    await registerAndEnrollFarmer(caOrg1Client, walletOrg1, mspOrg1, org1UserId, 'org1.department1');

    try {
        // Create a new gateway for connecting to Org's peer node.
        const gatewayOrg1 = new Gateway();
        //connect using Discovery enabled
        await gatewayOrg1.connect(ccpOrg1,
            { wallet: walletOrg1, identity: org1UserId, discovery: { enabled: true, asLocalhost: true } });

        return gatewayOrg1;
    } catch (error) {
        console.error(`Error in connecting to gateway: ${error}`);
        process.exit(1);
    }
}

async function initContractFromOrg2Identity() {
    console.log('\n--> Fabric client user & Gateway init: Using Org2 identity to Org2 Peer');
    const ccpOrg2 = buildCCPOrg2();
    const caOrg2Client = buildCAClient(FabricCAServices, ccpOrg2, 'ca.org2.example.com');

    const walletPathOrg2 = path.join(__dirname, 'wallet/org2');
    const walletOrg2 = await buildWallet(Wallets, walletPathOrg2);

    await enrollAdmin(caOrg2Client, walletOrg2, mspOrg2);
    await registerAndEnrollRetailer(caOrg2Client, walletOrg2, mspOrg2, org2UserId, 'org2.department1');

    try {
        // Create a new gateway for connecting to Org's peer node.
        const gatewayOrg2 = new Gateway();
        await gatewayOrg2.connect(ccpOrg2,
            { wallet: walletOrg2, identity: org2UserId, discovery: { enabled: true, asLocalhost: true } });

        return gatewayOrg2;
    } catch (error) {
        console.error(`Error in connecting to gateway: ${error}`);
        process.exit(1);
    }
}


async function main() {
	try {
        /** ******* Fabric client init: Using Org1 identity to Org1 Peer ********** */
        const gatewayOrg1 = await initContractFromOrg1Identity(org1UserId);
        const networkOrg1 = await gatewayOrg1.getNetwork(channelName);
        const contractOrg1 = networkOrg1.getContract(chaincodeName);
        contractOrg1.addDiscoveryInterest({ name: chaincodeName, collectionNames: [memberAssetCollectionName, org1PrivateCollectionName] });


        /** ~~~~~~~ Fabric client init: Using Org2 identity to Org2 Peer ~~~~~~~ */
        const gatewayOrg2 = await initContractFromOrg2Identity();
        const networkOrg2 = await gatewayOrg2.getNetwork(channelName);
        const contractOrg2 = networkOrg2.getContract(chaincodeName);
        contractOrg2.addDiscoveryInterest({ name: chaincodeName, collectionNames: [memberAssetCollectionName, org2PrivateCollectionName] });

		try {

			let asset='asset0'+temp;
			let randomNumber = Math.floor(Math.random() * 1000) + 1;
            // use a random key so that we can run multiple times
            let privateAssetID = `asset${randomNumber}`;

			let asset1Data = {assetID: privateAssetID, color: 'green', size: 20, appraisedValue: 100 ,secret:1234};
			console.log('------------------------Here Farmer Controls the App ------------------------\n');

			console.log('\n--> Submit Transaction: InitLedger, function creates the initial set of assets on the ledger');
			await contractOrg1.submitTransaction('InitLedger');
			console.log('*** Result: committed from ',org1UserId);

	
			console.log('\n--> Evaluate Transaction: GetAllAssets, function returns all the current assets on the ledger');
			let result = await contractOrg1.evaluateTransaction('GetAllAssets');
			console.log(`*** Result: ${prettyJSONString(result.toString())}`);

			console.log("******************PRIVATE ASSET CREATED ***********************")
            console.log('Adding Assets to work with:\n--> Submit Transaction: CreatePrivateAsset ' + privateAssetID);
            let statefulTxn = contractOrg1.createTransaction('CreatePrivateAsset');
            //if you need to customize endorsement to specific set of Orgs, use setEndorsingOrganizations
            //statefulTxn.setEndorsingOrganizations(mspOrg1);
            let tmapData = Buffer.from(JSON.stringify(asset1Data));
            statefulTxn.setTransient({
                asset_properties: tmapData
            });
            result = await statefulTxn.submit();

			console.log("Private Asset Was created. Public details should be present except secret!!!");
			console.log('\n--> This is going to return the details of ',privateAssetID);
			result = await contractOrg1.evaluateTransaction('ReadAsset', privateAssetID);
			console.log(`*** Result: ${prettyJSONString(result.toString())}`);

			
	



			console.log('\n--> Evaluate Transaction: AssetExists, function eturns "true" if an asset with given assetID exist');
			result = await contractOrg1.evaluateTransaction('AssetExists', privateAssetID);
			console.log(`*** Result: ${prettyJSONString(result.toString())}`);
			console.log("Now we are going to read all assets including ",privateAssetID)
			result = await contractOrg1.evaluateTransaction('GetAllAssets');
			console.log(`*** Result: ${prettyJSONString(result.toString())}`);


            console.log('\n--> Evaluate Transaction: ReadAssetPrivateDetails from ' + org1PrivateCollectionName);
            // ReadAssetPrivateDetails reads data from Org's private collection. Args: collectionName, assetID
            result = await contractOrg1.evaluateTransaction('ReadAssetPrivateDetails', org1PrivateCollectionName, privateAssetID);
            console.log(`<-- result: ${prettyJSONString(result.toString())}`);
            verifyAssetPrivateDetails(result, privateAssetID, 1234);


			// Attempt Transfer the asset to Org2 , without Org2 adding AgreeToTransfer //
			console.log("We are going to try TransferPrivateAsset without AgreeToTransfer")
            // Transaction should return an error: "failed transfer verification ..."
            let buyerDetails = { assetID: privateAssetID, buyerMSP: mspOrg2 };
            try {
                console.log('\n--> Attempt Submit Transaction: TransferPrivateAsset ' + privateAssetID);
                statefulTxn = contractOrg1.createTransaction('TransferPrivateAsset');
                tmapData = Buffer.from(JSON.stringify(buyerDetails));
                statefulTxn.setTransient({
                    asset_owner: tmapData
                });
                result = await statefulTxn.submit();
                console.log('******** FAILED: above operation expected to return an error');
            } catch (error) {
                console.log(`   Successfully caught the error: \n    ${error}`);
            }

			console.log('\n~~~~~~~~~~~~~~~~ As Org2 Client ~~~~~~~~~~~~~~~~');
            console.log('\n--> Evaluate Transaction: ReadAsset ' + privateAssetID);
            result = await contractOrg2.evaluateTransaction('ReadAsset', privateAssetID);
            console.log(`<-- result: ${prettyJSONString(result.toString())}`);
           // verifyAssetData(mspOrg2, result, privateAssetID, 'green', 20, org1UserId)

			console.log("Here we are going to AgreeTransfer")

			let dataForAgreement = { assetID: privateAssetID, secret: 1234 };
			console.log('\n--> Submit Transaction: AgreeToTransfer payload ' + JSON.stringify(dataForAgreement));
			statefulTxn = contractOrg2.createTransaction('AgreeToTransfer');
			tmapData = Buffer.from(JSON.stringify(dataForAgreement));
			statefulTxn.setTransient({
				asset_value: tmapData
			});
			result = await statefulTxn.submit()

            console.log('\n**************** As Org1 Client ****************');
            // All members can send txn ReadTransferAgreement, set by Org2 above
            console.log('\n--> Evaluate Transaction: ReadTransferAgreement ' + privateAssetID);
            result = await contractOrg1.evaluateTransaction('ReadTransferAgreement', privateAssetID);
            console.log(`<-- result: ${prettyJSONString(result.toString())}`);

            // Transfer the asset to Org2 //
            // To transfer the asset, the owner needs to pass the MSP ID of new asset owner, and initiate the transfer
            console.log('\n--> Submit Transaction: TransferPrivateAsset ' + privateAssetID);

            statefulTxn = contractOrg1.createTransaction('TransferPrivateAsset');
            tmapData = Buffer.from(JSON.stringify(buyerDetails));
            statefulTxn.setTransient({
                asset_owner: tmapData
            });
            result = await statefulTxn.submit();
	

			console.log('\n--> We are going to read privateAssetAfter after transfer to org2');
			//result = await contractOrg1.evaluateTransaction('ReadAsset', privateAssetID);
			//console.log(`*** Result: ${prettyJSONString(result.toString())}`);


			// result = await contractOrg1.evaluateTransaction('ReadAssetPrivateDetails', org1PrivateCollectionName, privateAssetID);
            // console.log(`<-- result: ${prettyJSONString(result.toString())}`);
            // if (result && result.length > 0) {
            //     doFail('Expected empty data from ReadAssetPrivateDetails');
            // }

			console.log('\n~~~~~~~~~~~~~~~~ As Org2 Client ~~~~~~~~~~~~~~~~');
            // Org2 can ReadAssetPrivateDetails: Org2 is owner, and private details exist in new owner's Collection
            console.log('\n--> Evaluate Transaction as Org2: ReadAssetPrivateDetails ' + privateAssetID + ' from ' + org2PrivateCollectionName);
            result = await contractOrg2.evaluateTransaction('ReadAssetPrivateDetails', org2PrivateCollectionName, privateAssetID);
            console.log(`<-- result: ${prettyJSONString(result.toString())}`);
            verifyAssetPrivateDetails(result, privateAssetID, 1234);	
			
			console.log('\n--> Evaluate Transaction: GetAssetHistory, get the history of an asset(asset7)');
			result = await contractOrg1.evaluateTransaction('GetAssetHistory', privateAssetID);
			console.log(`*** Result: ${prettyJSONString(result.toString())}`);



			gatewayOrg1.disconnect();
			console.log('------------------------Farmer user end here -----------------------------------\n');
			
			
			gatewayOrg2.disconnect();
		} finally {
			// Disconnect from the gateway when the application is closing
			// This will close all connections to the network
			
			
		}
	} catch (error) {
		console.error(`******** FAILED to run the application: ${error}`);
	}
}

main();
