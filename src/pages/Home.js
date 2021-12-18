import React, {PureComponent} from "react";
import Config from "../configs/Config";
import {db} from "../configs/FirebaseConfig";
import {collection, deleteDoc, doc, getDoc, getDocs, limit, onSnapshot, orderBy, query, setDoc, startAt, startAfter, Timestamp, updateDoc, where} from "firebase/firestore";
import IsEmpty from "../helpers/IsEmpty";
import update from "immutability-helper";
import {Collapse, FormControl, InputLabel, LinearProgress, MenuItem, Select, TablePagination, TextField} from "@mui/material";
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
        this.statuses = {
            zero: "not_deployed",
            first: "sleep",
            second: "awake",
            third: "done",
            fourth: "found",
        };
        this.state = {
            collection: collection(db, "pvks"),
            limit: limit(perPage),
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
                domain: "",
                status: "",
                start_crunch: "",
                end_crunch: "",
                last_crunch: "",
                output: [],
                updated_at: {
                    seconds: 0,
                    nanoseconds: 0
                }
            },
            lastData: {
                id: 0,
                domain: "",
                status: "",
                start_crunch: "",
                end_crunch: "",
                last_crunch: "",
                output: [],
                updated_at: {
                    seconds: 0,
                    nanoseconds: 0
                }
            },
            add: {
                domain: "",
                start_crunch: "",
                end_crunch: "",
                last_crunch: ""
            },
            addError: {
                domain: false,
                start_crunch: false,
                end_crunch: false,
                last_crunch: false
            },
            edit: {
                start_crunch: "",
                end_crunch: "",
                last_crunch: ""
            },
            editError: {
                start_crunch: false,
                end_crunch: false,
                last_crunch: false
            },
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
        if (!IsEmpty(this.state.listener)) this.state.listener();
    }

    isSleep(data) {
        return Date.now() - (new Timestamp(data.updated_at.seconds, data.updated_at.nanoseconds)).toMillis() >= this.thirtyMinutesInMillis;
    }
    getStatusText(data) {
        if (data.status === this.statuses.zero) {
            return <p className="m-0 fw-bold"><span className="text-warning">Not Deployed</span></p>;
        } else if (data.output.length > 0 && this.isSleep(data)) {
            return <p className="m-0 fw-bold"><span className="text-primary">Found</span> & <span className="text-danger">Sleep</span></p>;
        } else if (data.output.length > 0 && data.status === this.statuses.second) {
            return <p className="m-0 fw-bold"><span className="text-primary">Found</span> & <span className="text-info">Awake</span></p>;
        } else if (data.output.length > 0 && data.status === this.statuses.third) {
            return <p className="m-0 fw-bold"><span className="text-primary">Found</span> & <span className="text-success">Done</span></p>;
        } else if (data.output.length > 0) {
            return <p className="m-0 fw-bold"><span className="text-primary">Found</span></p>;
        } else if (this.isSleep(data) && data.status === this.statuses.third) {
            return <p className="m-0 fw-bold"><span className="text-danger">Sleep</span> & <span className="text-success">Done</span></p>;
        } else if (this.isSleep(data)) {
            return <p className="m-0 fw-bold"><span className="text-danger">Sleep</span></p>;
        } else if (data.status === this.statuses.third) {
            return <p className="m-0 fw-bold"><span className="text-success">Done</span></p>;
        } else if (data.status === this.statuses.second) {
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
        this.verifyOwner().then((result) => {
            let goto = document.createElement("a");
            goto.href = process.env.REACT_APP_AWAKE_URL.replace("{domain}", data.domain).replace("{last_crunch}", data.last_crunch).replace("{end_crunch}", data.end_crunch);
            goto.target = "_blank";
            goto.click();
            goto.remove();
        });
    }
    add() {
        this.setState({
            addError: {
                domain: false,
                start_crunch: false,
                end_crunch: false,
                last_crunch: false
            }
        }, () => {
            let errorDomain = false;
            let errorStartCrunch = false;
            let errorEndCrunch = false;
            let errorLastCrunch = false;
            if (IsEmpty(this.state.add.domain)) errorDomain = true;
            if (IsEmpty(this.state.add.start_crunch)) errorStartCrunch = true;
            if (IsEmpty(this.state.add.end_crunch)) errorEndCrunch = true;
            if (IsEmpty(this.state.add.last_crunch)) errorLastCrunch = true;
            if (!errorDomain && !errorStartCrunch && !errorEndCrunch && !errorLastCrunch) {
                this.verifyOwner().then((result) => {
                    getDoc(doc(db, "pvks", this.state.add.domain)).then((data) => {
                        if (IsEmpty(data.data())) {
                            setDoc(doc(db, "pvks", this.state.add.domain), {
                                id: this.state.lastData.id + 1,
                                domain: this.state.add.domain,
                                start_crunch: this.state.add.start_crunch,
                                end_crunch: this.state.add.end_crunch,
                                last_crunch: this.state.add.last_crunch,
                                output: [],
                                status: this.statuses.zero,
                                updated_at: Timestamp.now()
                            }).then((data) => {
                                this.setState({
                                    modalAdd: false
                                }, () => {
                                    this.props.navigate(Config.Links.Home);
                                });
                            }).catch((error) => {
                                window.alert("Whoops, something went wrong!");
                            }).finally(() => {
                                this.setState({
                                    loading: false
                                });
                            });
                        } else {
                            this.setState({
                                loading: false
                            }, () => {
                                window.alert("Domain already exists!");
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
            } else {
                this.setState({
                    addError: {
                        domain: errorDomain,
                        start_crunch: errorStartCrunch,
                        end_crunch: errorEndCrunch,
                        last_crunch: errorLastCrunch
                    }
                });
            }
        });
    }
    edit() {
        this.setState({
            editError: {
                start_crunch: false,
                end_crunch: false,
                last_crunch: false
            }
        }, () => {
            let errorStartCrunch = false;
            let errorEndCrunch = false;
            let errorLastCrunch = false;
            if (IsEmpty(this.state.edit.start_crunch)) errorStartCrunch = true;
            if (IsEmpty(this.state.edit.end_crunch)) errorEndCrunch = true;
            if (IsEmpty(this.state.edit.last_crunch)) errorLastCrunch = true;
            if (!errorStartCrunch && !errorEndCrunch && !errorLastCrunch) {
                this.verifyOwner().then((result) => {
                    updateDoc(doc(db, "pvks", this.state.dataDetail.domain), {
                        start_crunch: this.state.edit.start_crunch,
                        end_crunch: this.state.edit.end_crunch,
                        last_crunch: this.state.edit.last_crunch
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
                        start_crunch: errorStartCrunch,
                        end_crunch: errorEndCrunch,
                        last_crunch: errorLastCrunch
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
                    deleteDoc(doc(db, "pvks", this.state.dataDetail.domain)).then((data) => {
                        this.setState({
                            deleting: false,
                            modalDetail: false
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

    getDatabase() {
        this.getData();
        this.getLastData();
    }
    getData() {
        if (!IsEmpty(this.state.listener)) this.state.listener();
        this.setState({
            loading: true,
            listener: null
        }, () => {
            let queryWhere = null;
            if (!IsEmpty(this.state.query.search)) {
                queryWhere = where("domain", "==", this.state.query.search);
            } else if (!IsEmpty(this.state.query.filter)) {
                if (this.state.query.filter === this.statuses.first) queryWhere = where("updated_at", "<=", Timestamp.fromMillis(Date.now() - this.thirtyMinutesInMillis));
                else if (this.state.query.filter === this.statuses.fourth) queryWhere = where("output", "!=", []);
                else queryWhere = where("status", "==", this.state.query.filter);
            }

            let queryOrderBy = null;
            if (this.state.query.filter === this.statuses.first) queryOrderBy = orderBy("updated_at");
            else if (this.state.query.filter === this.statuses.fourth) queryOrderBy = orderBy("output");
            else queryOrderBy = orderBy("id");

            let queryStart = null;
            if (this.state.query.page === 1) queryStart = startAt(1);
            else queryStart = startAfter((this.state.query.page - 1) * this.state.query.perPage);

            let queryString = null;
            if (!IsEmpty(this.state.query.search) || !IsEmpty(this.state.query.filter)) queryString = query(this.state.collection, queryWhere, queryOrderBy, queryStart, this.state.limit);
            else queryString = query(this.state.collection, queryOrderBy, queryStart, this.state.limit);

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
                                        let find = snapshotListener.docs.find(value => value.id === this.state.dataDetail.domain);
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
    getLastData() {
        getDocs(query(
            this.state.collection,
            orderBy("id", "desc"),
            limit(1)
        )).then((snapshot) => {
            let data = {...this.state.lastData};
            snapshot.docs.map(value => data = value.data());
            this.setValue("lastData", data);
        }).catch((error) => {
            console.error("getLastData", error.message);
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
                        <div className="table-responsive pb-2 pb-sm-2 pb-md-0 pb-lg-0 pb-xl-0">
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
                                    label="Start Crunch *"
                                    size={"small"}
                                    className="w-100"
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
                                    edit: {
                                        start_crunch: this.state.dataDetail.start_crunch,
                                        end_crunch: this.state.dataDetail.end_crunch,
                                        last_crunch: this.state.dataDetail.last_crunch
                                    }
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
                        <div className="mt-3">
                            <TextField
                                label="Domain *"
                                size={"small"}
                                className="w-100"
                                error={this.state.addError.domain}
                                value={this.state.add.domain}
                                onChange={(event) => this.setValue("add", update(this.state.add, {
                                    domain: {$set: event.target.value}
                                }))}
                            />
                            <TextField
                                label="Start Crunch *"
                                size={"small"}
                                className="w-100 mt-3"
                                error={this.state.addError.start_crunch}
                                value={this.state.add.start_crunch}
                                onChange={(event) => this.setValue("add", update(this.state.add, {
                                    start_crunch: {$set: event.target.value}
                                }))}
                            />
                            <TextField
                                label="End Crunch *"
                                size={"small"}
                                className="w-100 mt-3"
                                error={this.state.addError.end_crunch}
                                value={this.state.add.end_crunch}
                                onChange={(event) => this.setValue("add", update(this.state.add, {
                                    end_crunch: {$set: event.target.value}
                                }))}
                            />
                            <TextField
                                label="Last Crunch *"
                                size={"small"}
                                className="w-100 mt-3"
                                error={this.state.addError.last_crunch}
                                value={this.state.add.last_crunch}
                                onChange={(event) => this.setValue("add", update(this.state.add, {
                                    last_crunch: {$set: event.target.value}
                                }))}
                            />
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
                            <div className="rounded d-flex justify-content-between box-shadow-primary bgc-white-opacity-95 hc-pagination px-3 py-2">
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
                                        <MenuItem value={this.statuses.zero}>Not Deployed</MenuItem>
                                        <MenuItem value={this.statuses.first}>Sleep</MenuItem>
                                        <MenuItem value={this.statuses.second}>Awake</MenuItem>
                                        <MenuItem value={this.statuses.third}>Done</MenuItem>
                                        <MenuItem value={this.statuses.fourth}>Found</MenuItem>
                                    </Select>
                                </FormControl>
                                <TextField
                                    label="Search by domain"
                                    size={"small"}
                                    className="w-100 mx-2"
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
                                                    <button className="btn btn-sm bgc-1C152D text-white w-100" onClick={(event) => this.awake(value)} disabled={value.status === this.statuses.zero || !this.isSleep(value)}>Awake</button>
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