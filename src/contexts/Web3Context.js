import React from "react";

const Web3Context = React.createContext({
    loading: true,
    web3: null,
    newBlockHeadersSubscription: null,
    account: "",
    primaryBalance: 0,
    kaytrin: null,
    loadWeb3: () => false
});

export default Web3Context;