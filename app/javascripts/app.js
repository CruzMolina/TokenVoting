// Import the page's CSS. Webpack will know what to do with it.
import "../stylesheets/app.css";

// Import libraries we need.
import { default as Web3 } from "web3";
import { default as contract } from "truffle-contract";

// Import our contract artifacts and turn them into usable abstractions.
import voting_artifacts from "../../build/contracts/Voting.json";

// Voting is our usable abstraction, which we'll use through the code below.
var Voting = contract(voting_artifacts);

let candidates = {};

let tokenPrice = null;

window.voteForCandidate = function(candidate) {
  let candidateName = $("#candidate").val();
  let voteTokens = $("#vote-tokens").val();
  $("#msg").html(
    "Vote has been submitted. The vote count will increment as soon as the vote is recorded on the blockchain. Please wait."
  );
  $("#candidate").val("");
  $("#vote-tokens").val("");

  /* Voting.deployed() returns an instance of the contract. Every call
     * in Truffle returns a promise which is why we have used then()
     * everywhere we have a transaction call
     */
  Voting.deployed().then(function(contractInstance) {
    contractInstance
      .voteForCandidate(candidateName, voteTokens, {
        gas: 140000,
        from: web3.eth.accounts[0]
      })
      .then(function() {
        let div_id = candidates[candidateName];
        return contractInstance.totalVotesFor
          .call(candidateName)
          .then(function(v) {
            $("#" + div_id).html(v.toString());
            $("#msg").html("");
          });
      });
  });
};

/* The user enters the total no. of tokens to buy. We calculate the total cost and send it in
 * the request. We have to send the value in Wei. So, we use the toWei helper method to convert
 * from Ether to Wei.
 */

window.buyTokens = function() {
  let tokensToBuy = $("#buy").val();
  let price = tokensToBuy * tokenPrice;
  $("#buy-msg").html("Purchase order has been submitted. Please wait.");
  Voting.deployed().then(function(contractInstance) {
    contractInstance
      .buy({ value: web3.toWei(price, "ether"), from: web3.eth.accounts[0] })
      .then(function(v) {
        $("#buy-msg").html("");
        web3.eth.getBalance(contractInstance.address, function(error, result) {
          $("#contract-balance").html(
            web3.fromWei(result.toString()) + " Ether"
          );
        });
      });
  });
  populateTokenData();
};

window.lookupVoterInfo = function() {
  let address = $("#voter-info").val();
  Voting.deployed().then(function(contractInstance) {
    contractInstance.voterDetails.call(address).then(function(v) {
      $("#tokens-bought").html("Total Tokens bought: " + v[0].toString());
      let votesPerCandidate = v[1];
      $("#votes-cast").empty();
      $("#votes-cast").append("Votes cast per candidate: <br>");
      let allCandidates = Object.keys(candidates);
      for (let i = 0; i < allCandidates.length; i++) {
        $("#votes-cast").append(
          allCandidates[i] + ": " + votesPerCandidate[i] + "<br>"
        );
      }
    });
  });
};

/* Instead of hardcoding the candidates hash, we now fetch the candidate list from
 * the blockchain and populate the array. Once we fetch the candidates, we setup the
 * table in the UI with all the candidates and the votes they have received.
 */
function populateCandidates() {
  Voting.deployed().then(function(contractInstance) {
    contractInstance.allCandidates.call().then(function(candidateArray) {
      for (let i = 0; i < candidateArray.length; i++) {
        /* We store the candidate names as bytes32 on the blockchain. We use the
         * handy toUtf8 method to convert from bytes32 to string
         */
        candidates[web3.toUtf8(candidateArray[i])] = "candidate-" + i;
      }
      setupCandidateRows();
      populateCandidateVotes();
      populateTokenData();
    });
  });
}

function populateCandidateVotes() {
  let candidateNames = Object.keys(candidates);
  for (var i = 0; i < candidateNames.length; i++) {
    let name = candidateNames[i];
    Voting.deployed().then(function(contractInstance) {
      contractInstance.totalVotesFor.call(name).then(function(v) {
        $("#" + candidates[name]).html(v.toString());
      });
    });
  }
}

function setupCandidateRows() {
  Object.keys(candidates).forEach(function(candidate) {
    $("#candidate-rows").append(
      "<tr><td>" +
        candidate +
        "</td><td id='" +
        candidates[candidate] +
        "'></td></tr>"
    );
  });
}

/* Fetch the total tokens, tokens available for sale and the price of
 * each token and display in the UI
 */
function populateTokenData() {
  Voting.deployed().then(function(contractInstance) {
    contractInstance.totalTokens().then(function(v) {
      $("#tokens-total").html(v.toString());
    });
    contractInstance.tokensSold.call().then(function(v) {
      $("#tokens-sold").html(v.toString());
    });
    contractInstance.tokenPrice().then(function(v) {
      tokenPrice = parseFloat(web3.fromWei(v.toString()));
      $("#token-cost").html(tokenPrice + " Ether");
    });
    web3.eth.getBalance(contractInstance.address, function(error, result) {
      $("#contract-balance").html(web3.fromWei(result.toString()) + " Ether");
    });
  });
}

$(document).ready(function() {
  if (typeof web3 !== "undefined") {
    console.warn("Using web3 detected from external source like Metamask");
    // Use Mist/MetaMask's provider
    window.web3 = new Web3(web3.currentProvider);
  } else {
    console.warn(
      "No web3 detected. Falling back to https://ropsten.infura.io/DZQCAMdvawWxFyA6OOtD node"
    );
    // fallback
    window.web3 = new Web3(
      new Web3.providers.HttpProvider(
        "https://ropsten.infura.io/DZQCAMdvawWxFyA6OOtD"
      )
    );
    console.log("https://ropsten.infura.io/DZQCAMdvawWxFyA6OOtD");
  }

  Voting.setProvider(web3.currentProvider);
  populateCandidates();
});
