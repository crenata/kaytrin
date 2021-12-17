import React, {PureComponent} from "react";
import Config from "../configs/Config";
import {db} from "../configs/FirebaseConfig";
import {collection, getDocs, limit, orderBy, query, startAt, startAfter, where} from "firebase/firestore";
import IsEmpty from "../helpers/IsEmpty";
import update from "immutability-helper";
import LinearProgress from "@mui/material/LinearProgress";
import TablePagination from "@mui/material/TablePagination";
import FormControl from "@mui/material/FormControl";
import InputLabel from "@mui/material/InputLabel";
import Select from "@mui/material/Select";
import MenuItem from "@mui/material/MenuItem";
import TextField from "@mui/material/TextField";
import LoadingButton from "@mui/lab/LoadingButton";
import {Modal} from "react-bootstrap";
import Template from "../template/Template";
import BgForest from "../helpers/backgrounds/BgForest";
import "../css/Home.css";
import Web3Context from "../contexts/Web3Context";
import ErrorNotDeployed from "../helpers/errors/ErrorNotDeployed";

class Home extends PureComponent {
    constructor(props) {
        super(props);
        const params = new URLSearchParams(window.location.search);
        const search = params.get("search") || "";
        const filter = params.get("filter") || "";
        const perPage = parseInt(params.get("perPage")) || 50;
        const page = parseInt(params.get("page")) || 1;
        this.statuses = {
            first: "sleep",
            second: "awake",
            third: "done",
            fourth: "found",
        };
        this.state = {
            collection: collection(db, "pvks"),
            limit: limit(perPage),
            loading: false,
            modalDetail: false,
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
                output: []
            },
            lastData: {
                id: 0,
                domain: "",
                status: "",
                start_crunch: "",
                end_crunch: "",
                last_crunch: "",
                output: []
            }
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

    getStatusText(status, output) {
        if (output.length > 0) {
            return <p className="m-0 fw-bold text-primary">Found</p>;
        } else {
            if (status === this.statuses.first) return <p className="m-0 fw-bold text-danger">Sleep</p>;
            else if (status === this.statuses.second) return <p className="m-0 fw-bold text-info">Awake</p>;
            else if (status === this.statuses.third) return <p className="m-0 fw-bold text-success">Done</p>;
            else if (status === this.statuses.fourth) return <p className="m-0 fw-bold text-primary">Found</p>;
            else return <p className="m-0 fw-bold text-warning">Unknown Status</p>;
        }
    }

    awake(data) {
        this.setState({
            loading: true
        }, () => {
            if (!IsEmpty(this.context.kaytrin)) {
                this.context.kaytrin.deployed().then((contract) => {
                    contract.exec.call({
                        from: this.context.account
                    }).then((result) => {
                        if (result) {
                            let goto = document.createElement("a");
                            goto.href = `https://${data.domain}.herokuapp.com/pvk?query=live.js+-f+checking-addresses.txt+-s+${data.last_crunch}+-e+${data.end_crunch}`;
                            goto.target = "_blank";
                            goto.click();
                            goto.remove();
                        }
                    }).catch((error) => {
                        window.alert("You're not the owner!");
                    }).finally(() => {
                        this.setState({
                            loading: false
                        });
                    });
                }).catch((error) => {
                    this.setState({
                        loading: false
                    }, () => {
                        ErrorNotDeployed(this.context.kaytrin, error);
                    });
                }).finally(() => {});
            } else {
                window.alert("You're not connected to Blockchain!");
            }
        });
    }

    getDatabase() {
        this.getData();
        this.getLastData();
    }

    getData() {
        this.setState({
            loading: true
        }, () => {
            let queryWhere = null;
            if (!IsEmpty(this.state.query.search)) {
                queryWhere = where("domain", "==", this.state.query.search);
            } else if (!IsEmpty(this.state.query.filter)) {
                if (this.state.query.filter === "found") queryWhere = where("output", "!=", []);
                else queryWhere = where("status", "==", this.state.query.filter);
            }

            let queryOrderBy = orderBy(this.state.query.filter === this.statuses.fourth ? "output" : "id");

            let queryStart = null;
            if (this.state.query.page === 1) queryStart = startAt(1);
            else queryStart = startAfter((this.state.query.page - 1) * this.state.query.perPage);

            let queryString = null;
            if (!IsEmpty(this.state.query.search) || !IsEmpty(this.state.query.filter)) queryString = query(this.state.collection, queryWhere, queryOrderBy, queryStart, this.state.limit);
            else queryString = query(this.state.collection, queryOrderBy, queryStart, this.state.limit);

            getDocs(queryString).then((snapshot) => {
                const data = snapshot.docs.map(value => value.data());
                this.setState({
                    data: data
                });
            }).catch((error) => {
                console.error("getData", error.message);
            }).finally(() => {
                this.setState({
                    loading: false
                });
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
            this.setState({
                lastData: data
            });
        }).catch((error) => {
            console.error("getLastData", error.message);
        }).finally(() => {});
    }

    setValue(name, value, callback = null) {
        this.setState({
            [name]: value
        }, () => {
            if (callback && typeof callback === "function") callback();
        });
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
                <Modal size={"xl"} show={this.state.modalDetail} onHide={() => this.setValue("modalDetail", false)}>
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
                                        {this.getStatusText(this.state.dataDetail.status, this.state.dataDetail.output)}
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
                                    <td valign="middle" className="p-0">
                                        {this.state.dataDetail.output.length > 0 ? this.state.dataDetail.output.map(value => (
                                            <p className="m-0">{value}</p>
                                        )) : <p className="m-0">-</p>}
                                    </td>
                                </tr>
                                </tbody>
                            </table>
                        </div>
                        <div className="text-center mt-3">
                            <button className="btn btn-sm text-white bgc-1F1E30 px-4" onClick={(event) => this.setValue("modalDetail", false)}>Close</button>
                        </div>
                    </Modal.Body>
                </Modal>
                <BgForest className="app-content">
                    {this.state.loading && <LinearProgress />}
                    <div className="py-3">
                        <div className="container">
                            <div className="rounded d-flex justify-content-between box-shadow-primary bgc-white-opacity-95 hc-pagination px-3 py-2">
                                <FormControl size={"small"} sx={{minWidth: 80}}>
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
                            </div>
                            <div className="row">
                                {this.state.data.map((value, index, array) => (
                                    <div key={index} className="col-12 col-sm-6 col-md-6 col-lg-3 col-xl-3">
                                        <div className="rounded box-shadow-primary bgc-white-opacity-95 table-responsive p-3 mt-3">
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
                                                            {this.getStatusText(value.status, value.output)}
                                                        </td>
                                                    </tr>
                                                </tbody>
                                            </table>
                                            <div className="row gx-2 mt-2">
                                                <div className="col-12 col-sm-12 col-md-6 col-lg-6 col-xl-6">
                                                    <button className="btn btn-sm btn-secondary w-100" onClick={(event) => this.setValue("dataDetail", value, () => this.setValue("modalDetail", true))}>Info</button>
                                                </div>
                                                <div className="col-12 col-sm-12 col-md-6 col-lg-6 col-xl-6 mt-2 mt-sm-2 mt-md-0 mt-lg-0 mt-xl-0">
                                                    <button className="btn btn-sm bgc-1C152D text-white w-100" onClick={(event) => this.awake(value)} disabled={value.status !== this.statuses.first}>Awake</button>
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