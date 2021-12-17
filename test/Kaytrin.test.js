/* eslint-disable no-undef */
const Kaytrin = artifacts.require("Kaytrin");
const Revert = require("./helpers/Revert");
contract(Kaytrin.contractName, (accounts) => {
    before(async () => {
        this.owner = accounts[0];
        this.otherAccount = accounts[1];
        this.kaytrin = await Kaytrin.deployed();
    });

    describe("Init", () => {
        it("Contract has been deployed successfully", async () => {
            let address = await this.kaytrin.address;
            assert.notEqual(address, 0x0);
            assert.notEqual(address, null);
            assert.notEqual(address, undefined);
            assert.notEqual(address, "");
            assert.equal(address.length, 42);
        });
    });

    describe("Exec", () => {
        it("Prevent non-owner to exec", async () => {
            await Revert(async () => await this.kaytrin.exec.call({
                from: this.otherAccount
            }));
        });
        it("Allows owner to exec", async () => {
            let receipt = await this.kaytrin.exec.call({
                from: this.owner
            });
            assert.equal(receipt, true);
        });
    });
});