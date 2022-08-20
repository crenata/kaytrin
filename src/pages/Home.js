import React, {PureComponent} from "react";
import Config from "../configs/Config";
import {db} from "../configs/FirebaseConfig";
import * as Platform from "../constants/Platform";
import * as Protocol from "../constants/Protocol";
import * as Status from "../constants/Status";
import * as Version from "../constants/Version";
import {collection, deleteDoc, doc, getDoc, getDocs, limit, onSnapshot, orderBy, query, setDoc, startAt, startAfter, Timestamp, updateDoc, where} from "firebase/firestore";
import IsEmpty from "../helpers/IsEmpty";
import IsEmail from "../helpers/IsEmail";
import UcFirst from "../helpers/UcFirst";
import update from "immutability-helper";
import {Chip, Collapse, Divider, FormControl, InputLabel, LinearProgress, MenuItem, Select, TablePagination, TextField} from "@mui/material";
import LoadingButton from "@mui/lab/LoadingButton";
import {Modal} from "react-bootstrap";
import Template from "../template/Template";
import BgForest from "../helpers/backgrounds/BgForest";
import Web3Context from "../contexts/Web3Context";
import ErrorNotDeployed from "../helpers/errors/ErrorNotDeployed";
import "../css/Home.css";

class Home extends PureComponent {
    constructor(props) {
        super(props);
        const params = new URLSearchParams(window.location.search);
        const search = params.get("search") || "";
        const filter = params.get("filter") || "";
        const perPage = parseInt(params.get("perPage")) || 50;
        const page = parseInt(params.get("page")) || 1;
        this.thirtyMinutesInMillis = 1000 * 60 * 30;
        this.commandAttributes = [
            {
                label: "Start Crunch",
                value: "{start_crunch}"
            },
            {
                label: "End Crunch",
                value: "{end_crunch}"
            },
            {
                label: "Last Crunch",
                value: "{last_crunch}"
            }
        ];
        this.addFields = {
            email: "",
            protocol: "",
            domain: "",
            platform: "",
            platform_domain: "",
            start_crunch: "",
            end_crunch: "",
            last_crunch: "",
            version: "",
            command: ""
        };
        this.errorFields = {
            email: false,
            protocol: false,
            domain: false,
            platform: false,
            platform_domain: false,
            start_crunch: false,
            end_crunch: false,
            last_crunch: false,
            version: false,
            status: false,
            command: false
        };
        this.state = {
            collection: collection(db, "pvks"),
            listener: null,
            loading: false,
            canSeeOutput: false,
            editing: false,
            deleting: false,
            modalDetail: false,
            modalAdd: false,
            data: [],
            query: {
                search: search,
                filter: filter,
                perPage: perPage,
                page: page
            },
            dataDetail: {
                id: 0,
                email: "",
                protocol: "",
                domain: "",
                platform: "",
                platform_domain: "",
                status: "",
                start_crunch: "",
                end_crunch: "",
                last_crunch: "",
                version: "",
                output: [],
                command: "",
                updated_at: {
                    seconds: 0,
                    nanoseconds: 0
                }
            },
            lastData: {
                id: 0,
                email: "",
                protocol: "",
                domain: "",
                platform: "",
                platform_domain: "",
                status: "",
                start_crunch: "",
                end_crunch: "",
                last_crunch: "",
                version: "",
                output: [],
                command: "",
                updated_at: {
                    seconds: 0,
                    nanoseconds: 0
                }
            },
            add: [this.addFields],
            addError: [this.errorFields],
            edit: {
                email: "",
                protocol: "",
                domain: "",
                platform: "",
                platform_domain: "",
                start_crunch: "",
                end_crunch: "",
                last_crunch: "",
                version: "",
                status: "",
                command: ""
            },
            editError: this.errorFields,
            delete: "",
            deleteError: false
        };
    }

    componentDidMount() {
        this.getDatabase();
    }
    componentDidUpdate(prevProps, prevState, snapshot) {
        if (this.props !== prevProps) {
            this.getDatabase();
        }
    }
    componentWillUnmount() {
        this.unListen();
    }

    isSleep(data) {
        return Date.now() - (new Timestamp(data.updated_at.seconds, data.updated_at.nanoseconds)).toMillis() >= this.thirtyMinutesInMillis;
    }
    getVersion(data) {
        if (IsEmpty(data) || data === Version.Legacy) return "pvk";
        else if (data === Version.V1) return "v1.php";
        else return "pvk";
    }
    getStatusText(data) {
        if (data.status === Status.NotDeployed) {
            return <p className="m-0 fw-bold"><span className="text-warning">Not Deployed</span></p>;
        } else if (data.status === Status.Suspend) {
            return <p className="m-0 fw-bold"><span className="text-danger">Suspend</span></p>;
        } else if (data.output.length > 0 && this.isSleep(data)) {
            return <p className="m-0 fw-bold"><span className="text-primary">Found</span> & <span className="text-danger">Sleep</span></p>;
        } else if (data.output.length > 0 && data.status === Status.Awake) {
            return <p className="m-0 fw-bold"><span className="text-primary">Found</span> & <span className="text-info">Awake</span></p>;
        } else if (data.output.length > 0 && data.status === Status.Done) {
            return <p className="m-0 fw-bold"><span className="text-primary">Found</span> & <span className="text-success">Done</span></p>;
        } else if (data.output.length > 0) {
            return <p className="m-0 fw-bold"><span className="text-primary">Found</span></p>;
        } else if (this.isSleep(data) && data.status === Status.Done) {
            return <p className="m-0 fw-bold"><span className="text-danger">Sleep</span> & <span className="text-success">Done</span></p>;
        } else if (this.isSleep(data)) {
            return <p className="m-0 fw-bold"><span className="text-danger">Sleep</span></p>;
        } else if (data.status === Status.Done) {
            return <p className="m-0 fw-bold"><span className="text-success">Done</span></p>;
        } else if (data.status === Status.Awake) {
            return <p className="m-0 fw-bold"><span className="text-info">Awake</span></p>;
        } else {
            return <p className="m-0 fw-bold"><span className="text-warning">Unknown</span></p>;
        }
    }
    verifyOwner() {
        return new Promise((resolve, reject) => {
            this.setState({
                loading: true
            }, () => {
                if (!IsEmpty(this.context.kaytrin)) {
                    this.context.kaytrin.deployed().then((contract) => {
                        contract.exec.call({
                            from: this.context.account
                        }).then((result) => {
                            if (result) resolve(result);
                        }).catch((error) => {
                            window.alert("You're not the owner!");
                        }).finally(() => {
                            this.setValue("loading", false);
                        });
                    }).catch((error) => {
                        this.setState({
                            loading: false
                        }, () => {
                            window.alert("Wrong network, use Ropsten Network!");
                            ErrorNotDeployed(this.context.kaytrin, error);
                        });
                    }).finally(() => {});
                } else {
                    this.setState({
                        loading: false
                    }, () => {
                        window.alert("You're not connected to Blockchain!");
                    });
                }
            });
        });
    }
    setValue(name, value, callback = null) {
        this.setState({
            [name]: value
        }, () => {
            if (callback && typeof callback === "function") callback();
        });
    }
    platformSearchObject = (value) => {
        return Object.keys(Platform).find(key => Platform[key].name === value);
    };
    appendToCursorPosition = (elementId, newText) => {
        let element = document.getElementById(elementId);
        let cursorPosition = element.selectionStart;
        let textBeforeCursorPosition = element.value.substring(0, cursorPosition);
        let textAfterCursorPosition = element.value.substring(cursorPosition, element.value.length);
        let textValue = textBeforeCursorPosition + newText + textAfterCursorPosition;
        return textValue;
    };

    reMigrate() {
        this.verifyOwner().then((result) => {
            getDocs(this.state.collection).then((snapshot) => {
                const data = snapshot.docs.map(value => value.data());
                data.forEach((value, index, array) => {
                    updateDoc(doc(db, "pvks", value.id.toString()), {
                        command: "live.js -f checking-addresses.txt -s {last_crunch} -e {end_crunch}"
                    }).then((result) => {
                        console.log("reMigrate/migrated", value.id);
                    }).catch((error) => {
                        console.error("reMigrate/addData", value.id, error.message);
                    }).finally(() => {});
                });
                this.setValue("loading", false);
            }).catch((error) => {
                console.error("reMigrate/getData", error.message);
            }).finally(() => {});
        });
    }
    seeOutput() {
        this.verifyOwner().then((result) => {
            this.setState({
                canSeeOutput: true
            }, () => {
                setTimeout(() => {
                    this.setState({
                        canSeeOutput: false
                    });
                }, 5000);
            });
        });
    }
    awake(data) {
        if (data.status === Status.NotDeployed || this.isSleep(data)) {
            this.verifyOwner().then((result) => {
                let goto = document.createElement("a");
                let command = data.command.replaceAll(" ", "+");
                this.commandAttributes.forEach(value => {
                    command = command.replaceAll(value.value, data[value.value.replace("{", "").replace("}", "")]);
                });
                goto.href = process.env.REACT_APP_AWAKE_URL
                    .replace("{protocol}", data.protocol)
                    .replace("{domain}", data.domain)
                    .replace("{platform_domain}", data.platform_domain)
                    .replace("{version}", this.getVersion(data.version)) + command;
                goto.target = "_blank";
                goto.click();
                goto.remove();
            });
        } else {
            window.alert(`${data.domain} domain isn't sleep!`);
        }
    }
    add() {
        let emptyErrors = [];
        this.state.add.forEach((value, index, array) => {
            emptyErrors.push(this.errorFields);
        });
        this.setState({
            addError: emptyErrors
        }, () => {
            let tempErrors = [];
            this.state.add.forEach((value, index, array) => {
                let errorEmail = IsEmpty(value.email) || !IsEmail(value.email);
                let errorProtocol = IsEmpty(value.protocol);
                let errorDomain = IsEmpty(value.domain);
                let errorPlatform = IsEmpty(value.platform);
                let errorPlatformDomain = IsEmpty(value.platform_domain);
                let errorStartCrunch = IsEmpty(value.start_crunch);
                let errorEndCrunch = IsEmpty(value.end_crunch);
                let errorLastCrunch = IsEmpty(value.last_crunch);
                let errorVersion = IsEmpty(value.version);
                let errorCommand = IsEmpty(value.command);
                tempErrors.push({
                    email: errorEmail,
                    protocol: errorProtocol,
                    domain: errorDomain,
                    platform: errorPlatform,
                    platform_domain: errorPlatformDomain,
                    start_crunch: errorStartCrunch,
                    end_crunch: errorEndCrunch,
                    last_crunch: errorLastCrunch,
                    version: errorVersion,
                    command: errorCommand
                });
                if (
                    !errorEmail &&
                    !errorProtocol &&
                    !errorDomain &&
                    !errorPlatform &&
                    !errorPlatformDomain &&
                    !errorStartCrunch &&
                    !errorEndCrunch &&
                    !errorLastCrunch &&
                    !errorVersion &&
                    !errorCommand
                ) {
                    this.verifyOwner().then((result) => {
                        getDoc(doc(db, "pvks", value.domain)).then((data) => {
                            if (IsEmpty(data.data())) {
                                let dataId = this.state.lastData.id + index + 1;
                                setDoc(doc(db, "pvks", dataId.toString()), {
                                    id: dataId,
                                    email: value.email,
                                    protocol: value.protocol,
                                    domain: value.domain,
                                    platform: value.platform,
                                    platform_domain: value.platform_domain,
                                    start_crunch: value.start_crunch,
                                    end_crunch: value.end_crunch,
                                    last_crunch: value.last_crunch,
                                    version: value.version,
                                    output: [],
                                    status: Status.NotDeployed,
                                    command: value.command,
                                    updated_at: Timestamp.now()
                                }).then((data) => {
                                    if (this.state.add.length > 1) {
                                        this.setState({
                                            add: update(this.state.add, {
                                                $splice: [[index, 1]]
                                            }),
                                            addError: update(this.state.addError, {
                                                $splice: [[index, 1]]
                                            })
                                        });
                                    } else {
                                        this.setState({
                                            add: [this.addFields],
                                            modalAdd: false
                                        });
                                    }
                                    this.props.navigate(Config.Links.Home);
                                }).catch((error) => {
                                    window.alert("Whoops, something went wrong!");
                                }).finally(() => {
                                    this.setValue("loading", false);
                                });
                            } else {
                                this.setState({
                                    loading: false
                                }, () => {
                                    window.alert(`${value.domain} domain already exists!`);
                                });
                            }
                        }).catch((error) => {
                            this.setState({
                                loading: false
                            }, () => {
                                window.alert("Whoops, something went wrong!");
                            });
                        }).finally(() => {});
                    });
                }
            });
            this.setState({
                addError: tempErrors
            }, () => this.getLastData());
        });
    }
    edit() {
        let data = this.state.edit;
        this.setState({
            editError: this.errorFields
        }, () => {
            let errorEmail = IsEmpty(data.email) || !IsEmail(data.email);
            let errorProtocol = IsEmpty(data.protocol);
            let errorDomain = IsEmpty(data.domain);
            let errorPlatform = IsEmpty(data.platform);
            let errorPlatformDomain = IsEmpty(data.platform_domain);
            let errorStartCrunch = IsEmpty(data.start_crunch);
            let errorEndCrunch = IsEmpty(data.end_crunch);
            let errorLastCrunch = IsEmpty(data.last_crunch);
            let errorVersion = IsEmpty(data.version);
            let errorStatus = IsEmpty(data.status);
            let errorCommand = IsEmpty(data.command);
            if (
                !errorEmail &&
                !errorProtocol &&
                !errorDomain &&
                !errorPlatform &&
                !errorPlatformDomain &&
                !errorStartCrunch &&
                !errorEndCrunch &&
                !errorLastCrunch &&
                !errorVersion &&
                !errorStatus &&
                !errorCommand
            ) {
                this.verifyOwner().then((result) => {
                    updateDoc(doc(db, "pvks", this.state.dataDetail.id.toString()), {
                        email: data.email,
                        protocol: data.protocol,
                        domain: data.domain,
                        platform: data.platform,
                        platform_domain: data.platform_domain,
                        start_crunch: data.start_crunch,
                        end_crunch: data.end_crunch,
                        last_crunch: data.last_crunch,
                        version: data.version,
                        status: data.status,
                        command: data.command
                    }).then((data) => {
                        this.setValue("editing", false);
                    }).catch((error) => {
                        window.alert("Whoops, something went wrong!");
                    }).finally(() => {
                        this.setValue("loading", false);
                    });
                });
            } else {
                this.setState({
                    editError: {
                        email: errorEmail,
                        protocol: errorProtocol,
                        domain: errorDomain,
                        platform: errorPlatform,
                        platform_domain: errorPlatformDomain,
                        start_crunch: errorStartCrunch,
                        end_crunch: errorEndCrunch,
                        last_crunch: errorLastCrunch,
                        version: errorVersion,
                        status: errorStatus,
                        command: errorCommand
                    }
                });
            }
        });
    }
    delete() {
        this.setState({
            deleteError: false
        }, () => {
            if (!IsEmpty(this.state.delete) && this.state.delete === this.state.dataDetail.domain) {
                this.verifyOwner().then((result) => {
                    deleteDoc(doc(db, "pvks", this.state.dataDetail.id.toString())).then((data) => {
                        this.setState({
                            deleting: false,
                            modalDetail: false,
                            delete: ""
                        });
                    }).catch((error) => {
                        window.alert("Whoops, something went wrong!");
                    }).finally(() => {
                        this.setValue("loading", false);
                    });
                });
            } else {
                this.setState({
                    deleteError: true
                });
            }
        });
    }

    unListen() {
        if (!IsEmpty(this.state.listener)) this.state.listener();
    }
    getDatabase() {
        this.getData();
        this.getLastData();
    }
    getData() {
        this.unListen();
        this.setState({
            loading: true,
            listener: null
        }, () => {
            let queryWhere = null;
            if (!IsEmpty(this.state.query.search)) {
                if (IsEmail(this.state.query.search)) queryWhere = where("email", "==", this.state.query.search);
                else queryWhere = where("domain", "==", this.state.query.search);
            } else if (!IsEmpty(this.state.query.filter)) {
                if (this.state.query.filter === Status.Sleep) queryWhere = where("updated_at", "<=", Timestamp.fromMillis(Date.now() - this.thirtyMinutesInMillis));
                else if (this.state.query.filter === Status.Awake) queryWhere = where("updated_at", ">", Timestamp.fromMillis(Date.now() - this.thirtyMinutesInMillis));
                else if (this.state.query.filter === Status.Found) queryWhere = where("output", "!=", []);
                else queryWhere = where("status", "==", this.state.query.filter);
            }

            let queryOrderBy = null;
            if (this.state.query.filter === Status.Sleep) queryOrderBy = orderBy("updated_at");
            else if (this.state.query.filter === Status.Awake) queryOrderBy = orderBy("updated_at");
            else if (this.state.query.filter === Status.Found) queryOrderBy = orderBy("output");
            else queryOrderBy = orderBy("id");

            let queryStart = null;
            if (this.state.query.page === 1) queryStart = startAt(1);
            else queryStart = startAfter((this.state.query.page - 1) * this.state.query.perPage);

            let queryLimit = limit(this.state.query.perPage);

            let queryString = null;
            if (!IsEmpty(this.state.query.search) || !IsEmpty(this.state.query.filter)) queryString = query(this.state.collection, queryWhere, queryOrderBy, queryStart, queryLimit);
            else queryString = query(this.state.collection, queryOrderBy, queryStart, queryLimit);

            getDocs(queryString).then((snapshot) => {
                this.setState({
                    data: []
                }, () => {
                    this.setState({
                        data: snapshot.docs.map(value => value.data()),
                        listener: onSnapshot(queryString, (snapshotListener) => {
                            this.setState({
                                data: []
                            }, () => {
                                this.setState({
                                    data: snapshotListener.docs.map(value => value.data())
                                }, () => {
                                    if (this.state.modalDetail) {
                                        let find = snapshotListener.docs.find(value => value.id.toString() === this.state.dataDetail.id.toString());
                                        if (!IsEmpty(find)) this.setState({
                                            dataDetail: find.data()
                                        });
                                    }
                                });
                            });
                        })
                    });
                });
            }).catch((error) => {
                console.error("getData", error.message);
            }).finally(() => {
                this.setValue("loading", false);
            });
        });
    }
    getLastData(callback = null) {
        getDocs(query(
            this.state.collection,
            orderBy("id", "desc"),
            limit(1)
        )).then((snapshot) => {
            let data = {...this.state.lastData};
            snapshot.docs.map(value => data = value.data());
            this.setValue("lastData", data, () => typeof callback === "function" && callback(data, null));
        }).catch((error) => {
            if (typeof callback === "function") callback(null, error);
        }).finally(() => {});
    }

    onPageChange(event, newPage) {
        this.setState({
            query: update(this.state.query, {
                page: {$set: newPage}
            })
        }, () => {
            this.generateQuery();
        });
    }
    onRowPerPageChange(event) {
        this.setState({
            query: update(this.state.query, {
                perPage: {$set: event.target.value},
                page: {$set: 1}
            })
        }, () => {
            this.generateQuery();
        });
    }
    generateQuery() {
        let query = "";
        if (!IsEmpty(this.state.query.search)) {
            query += `&search=${this.state.query.search}`;
        }
        if (!IsEmpty(this.state.query.filter)) {
            query += `&filter=${this.state.query.filter}`;
        }
        if (!IsEmpty(this.state.query.perPage)) {
            query += `&perPage=${this.state.query.perPage}`;
        }
        if (!IsEmpty(this.state.query.page)) {
            query += `&page=${this.state.query.page}`;
        }
        query = query.substring(1);
        this.props.navigate(`${Config.Links.Home}?${query}`);
    }

    render() {
        return (
            <Template className="bgc-1A1E23">
                <Modal size={"xl"} show={this.state.modalDetail} onHide={() => this.setState({
                    modalDetail: false,
                    editing: false
                })}>
                    <Modal.Body className="data-detail">
                        <div className="small table-responsive pb-2 pb-sm-2 pb-md-0 pb-lg-0 pb-xl-0">
                            <table className="table table-borderless w-auto m-0">
                                <tbody>
                                <tr>
                                    <td valign="middle" className="p-0">
                                        <p className="m-0">ID</p>
                                    </td>
                                    <td valign="middle" className="p-0">
                                        <p className="m-0 px-1">:</p>
                                    </td>
                                    <td valign="middle" className="p-0">
                                        <p className="m-0">{this.state.dataDetail.id}</p>
                                    </td>
                                </tr>
                                <tr>
                                    <td valign="middle" className="p-0">
                                        <p className="m-0">Email</p>
                                    </td>
                                    <td valign="middle" className="p-0">
                                        <p className="m-0 px-1">:</p>
                                    </td>
                                    <td valign="middle" className="p-0">
                                        <p className="m-0">{this.state.dataDetail.email}</p>
                                    </td>
                                </tr>
                                <tr>
                                    <td valign="middle" className="p-0">
                                        <p className="m-0">Protocol</p>
                                    </td>
                                    <td valign="middle" className="p-0">
                                        <p className="m-0 px-1">:</p>
                                    </td>
                                    <td valign="middle" className="p-0">
                                        <p className="m-0">{this.state.dataDetail.protocol}</p>
                                    </td>
                                </tr>
                                <tr>
                                    <td valign="middle" className="p-0">
                                        <p className="m-0">Domain</p>
                                    </td>
                                    <td valign="middle" className="p-0">
                                        <p className="m-0 px-1">:</p>
                                    </td>
                                    <td valign="middle" className="p-0">
                                        <p className="m-0">{this.state.dataDetail.domain}</p>
                                    </td>
                                </tr>
                                <tr>
                                    <td valign="middle" className="p-0">
                                        <p className="m-0">Platform</p>
                                    </td>
                                    <td valign="middle" className="p-0">
                                        <p className="m-0 px-1">:</p>
                                    </td>
                                    <td valign="middle" className="p-0">
                                        <p className="m-0">{this.state.dataDetail.platform}</p>
                                    </td>
                                </tr>
                                <tr>
                                    <td valign="middle" className="p-0">
                                        <p className="m-0">Platform Domain</p>
                                    </td>
                                    <td valign="middle" className="p-0">
                                        <p className="m-0 px-1">:</p>
                                    </td>
                                    <td valign="middle" className="p-0">
                                        <p className="m-0">{this.state.dataDetail.platform_domain}</p>
                                    </td>
                                </tr>
                                <tr>
                                    <td valign="middle" className="p-0">
                                        <p className="m-0">Status</p>
                                    </td>
                                    <td valign="middle" className="p-0">
                                        <p className="m-0 px-1">:</p>
                                    </td>
                                    <td valign="middle" className="p-0">
                                        {this.getStatusText(this.state.dataDetail)}
                                    </td>
                                </tr>
                                <tr>
                                    <td valign="middle" className="p-0">
                                        <p className="m-0">Start</p>
                                    </td>
                                    <td valign="middle" className="p-0">
                                        <p className="m-0 px-1">:</p>
                                    </td>
                                    <td valign="middle" className="p-0">
                                        <p className="m-0">{this.state.dataDetail.start_crunch}</p>
                                    </td>
                                </tr>
                                <tr>
                                    <td valign="middle" className="p-0">
                                        <p className="m-0">End</p>
                                    </td>
                                    <td valign="middle" className="p-0">
                                        <p className="m-0 px-1">:</p>
                                    </td>
                                    <td valign="middle" className="p-0">
                                        <p className="m-0">{this.state.dataDetail.end_crunch}</p>
                                    </td>
                                </tr>
                                <tr>
                                    <td valign="middle" className="p-0">
                                        <p className="m-0">Last</p>
                                    </td>
                                    <td valign="middle" className="p-0">
                                        <p className="m-0 px-1">:</p>
                                    </td>
                                    <td valign="middle" className="p-0">
                                        <p className="m-0">{this.state.dataDetail.last_crunch}</p>
                                    </td>
                                </tr>
                                <tr>
                                    <td valign="middle" className="p-0">
                                        <p className="m-0">Version</p>
                                    </td>
                                    <td valign="middle" className="p-0">
                                        <p className="m-0 px-1">:</p>
                                    </td>
                                    <td valign="middle" className="p-0">
                                        <p className="m-0">{this.state.dataDetail.version}</p>
                                    </td>
                                </tr>
                                <tr>
                                    <td valign="middle" className="p-0">
                                        <p className="m-0">Command</p>
                                    </td>
                                    <td valign="middle" className="p-0">
                                        <p className="m-0 px-1">:</p>
                                    </td>
                                    <td valign="middle" className="p-0">
                                        <p className="m-0">{this.state.dataDetail.command}</p>
                                    </td>
                                </tr>
                                <tr>
                                    <td valign="top" className="p-0">
                                        <p className="m-0">Output</p>
                                    </td>
                                    <td valign="top" className="p-0">
                                        <p className="m-0 px-1">:</p>
                                    </td>
                                    <td valign="top" className="p-0">
                                        {this.state.canSeeOutput ? <>
                                            {this.state.dataDetail.output.length > 0 ? this.state.dataDetail.output.map((value, index) => (
                                                <p key={index} className="m-0">{value}</p>
                                            )) : <p className="m-0">-</p>}
                                        </> : <LoadingButton
                                            size={"small"}
                                            color={"success"}
                                            loading={this.state.loading}
                                            variant={"outlined"}
                                            className="p-0"
                                            onClick={(event) => this.seeOutput()}
                                        >See</LoadingButton>}
                                    </td>
                                </tr>
                                </tbody>
                            </table>
                        </div>
                        <div className="mt-3">
                            <Collapse in={this.state.editing}>
                                <TextField
                                    type={"email"}
                                    label="Email *"
                                    size={"small"}
                                    className="w-100"
                                    error={this.state.editError.email}
                                    value={this.state.edit.email}
                                    onChange={(event) => this.setValue("edit", update(this.state.edit, {
                                        email: {$set: event.target.value}
                                    }))}
                                />
                                <FormControl fullWidth size={"small"} className="mt-3">
                                    <InputLabel id="edit-protocol">Protocol *</InputLabel>
                                    <Select
                                        labelId="edit-protocol"
                                        error={this.state.editError.protocol}
                                        value={this.state.edit.protocol}
                                        onChange={(event) => this.setValue("edit", update(this.state.edit, {
                                            protocol: {$set: event.target.value}
                                        }))}
                                        defaultValue={Protocol.Https}
                                    >
                                        {Object.keys(Protocol).map(protocol => (
                                            <MenuItem value={Protocol[protocol]}>{Protocol[protocol]}</MenuItem>
                                        ))}
                                    </Select>
                                </FormControl>
                                <TextField
                                    label="Domain *"
                                    size={"small"}
                                    className="w-100 mt-3"
                                    error={this.state.editError.domain}
                                    value={this.state.edit.domain}
                                    onChange={(event) => this.setValue("edit", update(this.state.edit, {
                                        domain: {$set: event.target.value}
                                    }))}
                                />
                                <FormControl fullWidth size={"small"} className="mt-3">
                                    <InputLabel id="edit-platform">Platform *</InputLabel>
                                    <Select
                                        labelId="edit-platform"
                                        error={this.state.editError.platform}
                                        value={this.state.edit.platform}
                                        onChange={(event) => this.setValue("edit", update(this.state.edit, {
                                            platform: {$set: event.target.value},
                                            platform_domain: {$set: Platform[this.platformSearchObject(event.target.value)].domain}
                                        }))}
                                        defaultValue={Platform.InfinityFree.name}
                                    >
                                        {Object.keys(Platform).map(platform => (
                                            <MenuItem value={Platform[platform].name}>{Platform[platform].name}</MenuItem>
                                        ))}
                                    </Select>
                                </FormControl>
                                <TextField
                                    label="Platform Domain *"
                                    size={"small"}
                                    className="w-100 mt-3"
                                    error={this.state.editError.platform_domain}
                                    value={this.state.edit.platform_domain}
                                    /*onChange={(event) => this.setValue("edit", update(this.state.edit, {
                                        platform_domain: {$set: event.target.value}
                                    }))}*/
                                    disabled
                                />
                                <TextField
                                    label="Start Crunch *"
                                    size={"small"}
                                    className="w-100 mt-3"
                                    error={this.state.editError.start_crunch}
                                    value={this.state.edit.start_crunch}
                                    onChange={(event) => this.setValue("edit", update(this.state.edit, {
                                        start_crunch: {$set: event.target.value}
                                    }))}
                                />
                                <TextField
                                    label="End Crunch *"
                                    size={"small"}
                                    className="w-100 mt-3"
                                    error={this.state.editError.end_crunch}
                                    value={this.state.edit.end_crunch}
                                    onChange={(event) => this.setValue("edit", update(this.state.edit, {
                                        end_crunch: {$set: event.target.value}
                                    }))}
                                />
                                <TextField
                                    label="Last Crunch *"
                                    size={"small"}
                                    className="w-100 mt-3"
                                    error={this.state.editError.last_crunch}
                                    value={this.state.edit.last_crunch}
                                    onChange={(event) => this.setValue("edit", update(this.state.edit, {
                                        last_crunch: {$set: event.target.value}
                                    }))}
                                />
                                <FormControl fullWidth size={"small"} className="mt-3">
                                    <InputLabel id="edit-version">Version *</InputLabel>
                                    <Select
                                        labelId="edit-version"
                                        error={this.state.editError.version}
                                        value={this.state.edit.version}
                                        onChange={(event) => this.setValue("edit", update(this.state.edit, {
                                            version: {$set: event.target.value}
                                        }))}
                                        defaultValue={Version.V1}
                                    >
                                        {Object.keys(Version).map(version => (
                                            <MenuItem value={Version[version]}>{Version[version]}</MenuItem>
                                        ))}
                                    </Select>
                                </FormControl>
                                <FormControl fullWidth size={"small"} className="mt-3">
                                    <InputLabel id="edit-status">Status *</InputLabel>
                                    <Select
                                        labelId="edit-status"
                                        value={this.state.edit.status}
                                        onChange={(event) => this.setValue("edit", update(this.state.edit, {
                                            status: {$set: event.target.value}
                                        }))}
                                        defaultValue={Status.NotDeployed}
                                    >
                                        {Object.keys(Status).map(status => (
                                            <MenuItem value={Status[status]}>{UcFirst(Status[status].replaceAll("_", " "))}</MenuItem>
                                        ))}
                                    </Select>
                                </FormControl>
                                <TextField
                                    id="edit-command"
                                    label="Command *"
                                    size={"small"}
                                    className="w-100 mt-3"
                                    error={this.state.editError.command}
                                    value={this.state.edit.command}
                                    onChange={(event) => this.setValue("edit", update(this.state.edit, {
                                        command: {$set: event.target.value}
                                    }))}
                                />
                                <div className="mt-2">
                                    {this.commandAttributes.map((value, index) => (
                                        <button className={`btn btn-sm border-1F1E30 ${index !== 0 && "ms-2"}`} onClick={event => {
                                            this.setValue("edit", update(this.state.edit, {
                                                command: {$set: this.appendToCursorPosition("edit-command", value.value)}
                                            }));
                                        }}>{value.label}</button>
                                    ))}
                                </div>
                            </Collapse>
                        </div>
                        <div className="mt-3">
                            <Collapse in={this.state.deleting}>
                                <TextField
                                    label="Type the domain *"
                                    size={"small"}
                                    className="w-100"
                                    error={this.state.deleteError}
                                    value={this.state.delete}
                                    onChange={(event) => this.setValue("delete", event.target.value)}
                                />
                            </Collapse>
                        </div>
                        <div className="text-center mt-3">
                            {this.state.editing ?
                                <>
                                    <LoadingButton
                                        size={"small"}
                                        color={"primary"}
                                        loading={this.state.loading}
                                        variant={"contained"}
                                        onClick={(event) => this.edit()}
                                    >Save</LoadingButton>
                                    <button className="btn btn-sm btn-secondary px-3 ms-3" onClick={(event) => this.setValue("editing", false)}>Cancel</button>
                                </> :
                                <button className="btn btn-sm text-white bgc-FFA500 px-4" onClick={(event) => this.setState({
                                    editing: true,
                                    deleting: false,
                                    edit: this.state.dataDetail
                                })}>Edit</button>
                            }
                            <button className="btn btn-sm text-white bgc-1F1E30 px-4 mx-3" onClick={(event) => this.setState({
                                modalDetail: false,
                                editing: false
                            })}>Close</button>
                            {this.state.deleting ?
                                <LoadingButton
                                    size={"small"}
                                    color={"error"}
                                    loading={this.state.loading}
                                    variant={"contained"}
                                    onClick={(event) => this.delete()}
                                >Delete</LoadingButton> :
                                <button className="btn btn-sm btn-danger px-4" onClick={(event) => this.setState({
                                    deleting: true,
                                    editing: false
                                })}>Delete</button>
                            }
                        </div>
                    </Modal.Body>
                </Modal>
                <Modal size={"xl"} show={this.state.modalAdd} onHide={() => this.setValue("modalAdd", false)}>
                    <Modal.Body className="data-detail">
                        <h6 className="m-0">Add New Domain</h6>
                        <div className="modal-add-fields overflow-auto">
                            {this.state.add.map((value, index, array) => (
                                <div className="mt-3" key={index}>
                                    <Divider>
                                        <Chip label={`Item ${index + 1}`} />
                                    </Divider>
                                    <TextField
                                        type={"email"}
                                        label="Email *"
                                        size={"small"}
                                        className="w-100 mt-3"
                                        error={this.state.addError[index].email}
                                        value={value.email}
                                        onChange={(event) => this.setValue("add", update(this.state.add, {
                                            [index]: {
                                                email: {$set: event.target.value}
                                            }
                                        }))}
                                    />
                                    <FormControl fullWidth size={"small"} className="mt-3">
                                        <InputLabel id="add-protocol">Protocol *</InputLabel>
                                        <Select
                                            labelId="add-protocol"
                                            error={this.state.addError[index].protocol}
                                            value={value.protocol}
                                            onChange={(event) => this.setValue("add", update(this.state.add, {
                                                [index]: {
                                                    protocol: {$set: event.target.value}
                                                }
                                            }))}
                                            defaultValue={Protocol.Https}
                                        >
                                            {Object.keys(Protocol).map(protocol => (
                                                <MenuItem value={Protocol[protocol]}>{Protocol[protocol]}</MenuItem>
                                            ))}
                                        </Select>
                                    </FormControl>
                                    <TextField
                                        label="Domain *"
                                        size={"small"}
                                        className="w-100 mt-3"
                                        error={this.state.addError[index].domain}
                                        value={value.domain}
                                        onChange={(event) => this.setValue("add", update(this.state.add, {
                                            [index]: {
                                                domain: {$set: event.target.value}
                                            }
                                        }))}
                                    />
                                    <FormControl fullWidth size={"small"} className="mt-3">
                                        <InputLabel id="add-platform">Platform *</InputLabel>
                                        <Select
                                            labelId="add-platform"
                                            error={this.state.addError[index].platform}
                                            value={value.platform}
                                            onChange={(event) => this.setValue("add", update(this.state.add, {
                                                [index]: {
                                                    platform: {$set: event.target.value},
                                                    platform_domain: {$set: Platform[this.platformSearchObject(event.target.value)].domain}
                                                }
                                            }))}
                                            defaultValue={Platform.InfinityFree.name}
                                        >
                                            {Object.keys(Platform).map(platform => (
                                                <MenuItem value={Platform[platform].name}>{Platform[platform].name}</MenuItem>
                                            ))}
                                        </Select>
                                    </FormControl>
                                    <TextField
                                        label="Platform Domain *"
                                        size={"small"}
                                        className="w-100 mt-3"
                                        error={this.state.addError[index].platform_domain}
                                        value={value.platform_domain}
                                        /*onChange={(event) => this.setValue("add", update(this.state.edit, {
                                            [index]: {
                                                platform_domain: {$set: event.target.value}
                                            }
                                        }))}*/
                                        disabled
                                    />
                                    <TextField
                                        label="Start Crunch *"
                                        size={"small"}
                                        className="w-100 mt-3"
                                        error={this.state.addError[index].start_crunch}
                                        value={value.start_crunch}
                                        onChange={(event) => this.setValue("add", update(this.state.add, {
                                            [index]: {
                                                start_crunch: {$set: event.target.value}
                                            }
                                        }))}
                                    />
                                    <TextField
                                        label="End Crunch *"
                                        size={"small"}
                                        className="w-100 mt-3"
                                        error={this.state.addError[index].end_crunch}
                                        value={value.end_crunch}
                                        onChange={(event) => this.setValue("add", update(this.state.add, {
                                            [index]: {
                                                end_crunch: {$set: event.target.value}
                                            }
                                        }))}
                                    />
                                    <TextField
                                        label="Last Crunch *"
                                        size={"small"}
                                        className="w-100 mt-3"
                                        error={this.state.addError[index].last_crunch}
                                        value={value.last_crunch}
                                        onChange={(event) => this.setValue("add", update(this.state.add, {
                                            [index]: {
                                                last_crunch: {$set: event.target.value}
                                            }
                                        }))}
                                    />
                                    <FormControl fullWidth size={"small"} className="mt-3">
                                        <InputLabel id="add-version">Version *</InputLabel>
                                        <Select
                                            labelId="add-version"
                                            error={this.state.addError[index].version}
                                            value={value.version}
                                            onChange={(event) => this.setValue("add", update(this.state.add, {
                                                [index]: {
                                                    version: {$set: event.target.value}
                                                }
                                            }))}
                                            defaultValue={Version.V1}
                                        >
                                            {Object.keys(Version).map(version => (
                                                <MenuItem value={Version[version]}>{Version[version]}</MenuItem>
                                            ))}
                                        </Select>
                                    </FormControl>
                                    <TextField
                                        id={`add-command-${index}`}
                                        label="Command *"
                                        size={"small"}
                                        className="w-100 mt-3"
                                        error={this.state.addError[index].command}
                                        value={value.command}
                                        onChange={(event) => this.setValue("add", update(this.state.add, {
                                            [index]: {
                                                command: {$set: event.target.value}
                                            }
                                        }))}
                                    />
                                    <div className="mt-2">
                                        {this.commandAttributes.map((value1, index1) => (
                                            <button className={`btn btn-sm border-1F1E30 ${index1 !== 0 && "ms-2"}`} onClick={event => {
                                                this.setValue("add", update(this.state.add, {
                                                    [index]: {
                                                        command: {$set: this.appendToCursorPosition(`add-command-${index}`, value1.value)}
                                                    }
                                                }));
                                            }}>{value1.label}</button>
                                        ))}
                                    </div>
                                    {this.state.add.length > 1 && <button className="btn btn-sm btn-danger px-4 mt-3" onClick={(event) => this.setState({
                                        add: update(this.state.add, {
                                            $splice: [[index, 1]]
                                        }),
                                        addError: update(this.state.addError, {
                                            $splice: [[index, 1]]
                                        })
                                    })}>-Delete</button>}
                                </div>
                            ))}
                        </div>
                        <div className="mt-3">
                            <button className="btn btn-sm text-white bgc-1F1E30 px-4" onClick={(event) => this.setState({
                                add: update(this.state.add, {
                                    $push: [this.addFields]
                                }),
                                addError: update(this.state.addError, {
                                    $push: [this.errorFields]
                                })
                            })}>+Add</button>
                        </div>
                        <div className="text-center mt-5">
                            <button className="btn btn-sm text-white bgc-1F1E30 px-4" onClick={(event) => this.setValue("modalAdd", false)}>Close</button>
                            <LoadingButton
                                size={"small"}
                                color={"primary"}
                                loading={this.state.loading}
                                variant={"contained"}
                                onClick={(event) => this.add()}
                                className="ms-2 px-4"
                            >Add</LoadingButton>
                        </div>
                    </Modal.Body>
                </Modal>
                <BgForest className="app-content">
                    {this.state.loading && <LinearProgress />}
                    <div className="py-3">
                        <div className="container">
                            <div className="rounded d-flex box-shadow-primary bgc-white-opacity-95 hc-pagination px-3 py-2">
                                <FormControl size={"small"} sx={{minWidth: 100}}>
                                    <InputLabel id="query-filter">Filter</InputLabel>
                                    <Select
                                        labelId="query-filter"
                                        value={this.state.query.filter}
                                        onChange={(event) => this.setValue("query", update(this.state.query, {
                                            search: {$set: ""},
                                            filter: {$set: event.target.value}
                                        }), () => this.generateQuery())}
                                        autoWidth
                                    >
                                        <MenuItem value=""><em>None</em></MenuItem>
                                        {Object.keys(Status).map(status => (
                                            <MenuItem value={Status[status]}>{UcFirst(Status[status].replaceAll("_", " "))}</MenuItem>
                                        ))}
                                    </Select>
                                </FormControl>
                                {/*<LoadingButton
                                    color={"info"}
                                    loading={this.state.loading}
                                    variant={"contained"}
                                    onClick={(event) => this.reMigrate()}
                                    className="ms-2 white-space-nowrap"
                                >Re-migrate</LoadingButton>*/}
                                <TextField
                                    label="Search by Domain/Email"
                                    size={"small"}
                                    className="w-100 ms-2"
                                    value={this.state.query.search}
                                    onChange={(event) => this.setValue("query", update(this.state.query, {
                                        search: {$set: event.target.value},
                                        filter: {$set: ""}
                                    }))}
                                />
                                <LoadingButton
                                    color={"success"}
                                    loading={this.state.loading}
                                    variant={"outlined"}
                                    onClick={(event) => this.onPageChange(event, 1)}
                                    className="ms-2"
                                >Search</LoadingButton>
                                <LoadingButton
                                    color={"primary"}
                                    variant={"contained"}
                                    onClick={(event) => this.setValue("modalAdd", true)}
                                    className="ms-2 white-space-nowrap"
                                >Add New</LoadingButton>
                            </div>
                            <div className="row">
                                {this.state.data.map((value, index, array) => (
                                    <div key={index} className="col-12 col-sm-6 col-md-6 col-lg-3 col-xl-3">
                                        <div className="small rounded box-shadow-primary bgc-white-opacity-95 table-responsive p-3 mt-3">
                                            <table className="table table-borderless m-0">
                                                <tbody>
                                                    <tr>
                                                        <td valign="middle" className="p-0">
                                                            <p className="m-0">Domain</p>
                                                        </td>
                                                        <td valign="middle" className="p-0">
                                                            <p className="m-0 px-1">:</p>
                                                        </td>
                                                        <td valign="middle" className="p-0">
                                                            <p className="m-0">{value.domain}</p>
                                                        </td>
                                                    </tr>
                                                    <tr>
                                                        <td valign="middle" className="p-0">
                                                            <p className="m-0">Platform</p>
                                                        </td>
                                                        <td valign="middle" className="p-0">
                                                            <p className="m-0 px-1">:</p>
                                                        </td>
                                                        <td valign="middle" className="p-0">
                                                            <p className="m-0">{value.platform}</p>
                                                        </td>
                                                    </tr>
                                                    <tr>
                                                        <td valign="middle" className="p-0">
                                                            <p className="m-0">Status</p>
                                                        </td>
                                                        <td valign="middle" className="p-0">
                                                            <p className="m-0 px-1">:</p>
                                                        </td>
                                                        <td valign="middle" className="p-0">
                                                            {this.getStatusText(value)}
                                                        </td>
                                                    </tr>
                                                </tbody>
                                            </table>
                                            <div className="row gx-2 mt-2">
                                                <div className="col-12 col-sm-12 col-md-6 col-lg-6 col-xl-6">
                                                    <button className="btn btn-sm btn-secondary w-100" onClick={(event) => this.setValue("dataDetail", value, () => this.setValue("modalDetail", true))}>Info</button>
                                                </div>
                                                <div className="col-12 col-sm-12 col-md-6 col-lg-6 col-xl-6 mt-2 mt-sm-2 mt-md-0 mt-lg-0 mt-xl-0">
                                                    {value.status === Status.NotDeployed ?
                                                        <button className="btn btn-sm bgc-1C152D text-white w-100" onClick={(event) => this.awake(value)}>Start</button> :
                                                        <button className="btn btn-sm bgc-1C152D text-white w-100" onClick={(event) => this.awake(value)} disabled={!this.isSleep(value)}>Awake</button>
                                                    }
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                            <div className="d-flex justify-content-center mt-3">
                                <div className="rounded box-shadow-primary bgc-white-opacity-95 hc-pagination">
                                    <TablePagination
                                        count={this.state.lastData.id}
                                        page={this.state.query.page - 1}
                                        onPageChange={(event, newPage) => this.onPageChange(event, newPage + 1)}
                                        rowsPerPage={this.state.query.perPage}
                                        onRowsPerPageChange={(event) => this.onRowPerPageChange(event)}
                                    />
                                </div>
                            </div>
                        </div>
                    </div>
                </BgForest>
            </Template>
        );
    }
}

Home.contextType = Web3Context;

export default Home;