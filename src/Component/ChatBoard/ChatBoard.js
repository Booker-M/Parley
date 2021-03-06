import moment from 'moment'
import React, {Component} from 'react'
import ReactLoading from 'react-loading'
import 'react-toastify/dist/ReactToastify.css'
import {myFirestore, myStorage} from '../../Config/MyFirebase'
import images from '../Themes/Images'
import './ChatBoard.css'
import {AppString} from './../Const'
import StickerSelect from './StickerSelect'
import ListOfMessages from './ListOfMessages'
import Confirmation from '../Confirmation/Confirmation'
import { toast } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';

//Only works properly as a component for now
export default class ChatBoard extends Component {
    constructor(props) {
        super(props)
        this.state = {
            isLoading: false,
            isShowSticker: false,
            inputValue: '',
            isOpenReportConfirm: false,
            isOpenRemoveConfirm: false
        }
        this.currentUserId = localStorage.getItem(AppString.ID)
        this.listMessage = []
        this.currentPeerUser = this.props.currentPeerUser
        this.groupChatId = null
        this.removeListener = null
        this.currentPhotoFile = null
    }

    componentDidUpdate() {
        this.scrollToBottom()
    }

    componentDidMount() {
        this.getListHistory()
    }
    

    componentWillUnmount() {
        if (this.removeListener) {
            this.removeListener()
        }
    }

    componentWillReceiveProps(newProps) {
        if (newProps.currentPeerUser) {
            this.currentPeerUser = newProps.currentPeerUser
            this.getListHistory()
        }
    }

    getListHistory = () => {
        if (this.removeListener) {
            this.removeListener()
        }
        this.listMessage.length = 0
        this.setState({isLoading: true})

        this.groupChatId = this.hashString(this.currentUserId) <= this.hashString(this.currentPeerUser.id) 
            ? `${this.currentUserId}-${this.currentPeerUser.id}` : `${this.currentPeerUser.id}-${this.currentUserId}`

        // Get history and listen for new data added
        this.removeListener = myFirestore
            .collection(AppString.NODE_MESSAGES)
            .doc(this.groupChatId)
            .collection(this.groupChatId)
            .onSnapshot(
                snapshot => {
                    snapshot.docChanges().forEach(change => {
                        if (change.type === AppString.DOC_ADDED) {
                            this.listMessage.push(change.doc.data())
                        }
                    })
                    this.setState({isLoading: false})
                },
                err => {
                    this.props.showToast(0, err.toString())
                }
            )
    }

    openListSticker = () => {
        this.setState({isShowSticker: !this.state.isShowSticker})
        console.log(this.state.isShowSticker)
    }

    onSendMessage = (content, type) => {
        if (this.state.isShowSticker && type === 2) {
            this.setState({isShowSticker: false})
        }

        if (content.trim() === '') {
            return
        }

        const timestamp = moment()
            .valueOf()
            .toString()

        const itemMessage = {
            idFrom: this.currentUserId,
            idTo: this.currentPeerUser.id,
            timestamp: timestamp,
            content: content.trim(),
            type: type
        }

        myFirestore
            .collection(AppString.NODE_MESSAGES)
            .doc(this.groupChatId)
            .collection(this.groupChatId)
            .doc(timestamp)
            .set(itemMessage)
            .then(() => {
                this.setState({inputValue: ''})
            })
            .catch(err => {
                toast.error(err.toString())
            })
    }

    onChoosePhoto = event => {
        if (event.target.files && event.target.files[0]) {
            this.setState({isLoading: true})
            this.currentPhotoFile = event.target.files[0]
            // Check if this file is an image?
            const prefixFiletype = event.target.files[0].type.toString()
            if (prefixFiletype.indexOf(AppString.PREFIX_IMAGE) === 0) {
                this.uploadPhoto()
            } else {
                this.setState({isLoading: false})
                this.props.showToast(0, 'This file is not an image')
            }
        } else {
            this.setState({isLoading: false})
        }
    }

    uploadPhoto = () => {
        if (this.currentPhotoFile) {
            const timestamp = moment()
                .valueOf()
                .toString()

            const uploadTask = myStorage
                .ref()
                .child(timestamp)
                .put(this.currentPhotoFile)

            uploadTask.on(
                AppString.UPLOAD_CHANGED,
                null,
                err => {
                    this.setState({isLoading: false})
                    this.props.showToast(0, err.message)
                },
                () => {
                    uploadTask.snapshot.ref.getDownloadURL().then(downloadURL => {
                        this.setState({isLoading: false})
                        this.onSendMessage(downloadURL, 1)
                    })
                }
            )
        } else {
            this.setState({isLoading: false})
            this.props.showToast(0, 'File is null')
        }
    }

    onKeyboardPress = event => {
        if (event.key === 'Enter') {
            this.onSendMessage(this.state.inputValue, 0)
        }
    }

    scrollToBottom = () => {
        if (this.messagesEnd) {
            this.messagesEnd.scrollIntoView({})
        }
    }

    hashString = str => {
        let hash = 0
        for (let i = 0; i < str.length; i++) {
            hash += Math.pow(str.charCodeAt(i) * 31, str.length - i)
            hash = hash & hash // Convert to 32bit integer
        }
        return hash
    }

    remove = () => {
        this.hideRemove()
    }

    report = () => {
        this.setState({isLoading: true})
        myFirestore
            .collection(AppString.NODE_USERS)
            .doc(this.currentUserId)
            .collection(AppString.REPORTED)
            .doc(this.currentPeerUser.id)
            .set({id: this.currentPeerUser.id})
            this.setState({isOpenReportConfirm: false})
        this.remove()
        this.hideReport()
        toast.warn(`Reported ${this.currentPeerUser.nickname}`)
    }

    remove = () => {
        this.setState({isLoading: true})
        myFirestore
            .collection(AppString.NODE_USERS)
            .doc(this.currentUserId)
            .collection(AppString.FRIENDS)
            .doc(this.currentPeerUser.id)
            .delete().then(
        myFirestore
            .collection(AppString.NODE_USERS)
            .doc(this.currentPeerUser.id)
            .collection(AppString.FRIENDS)
            .doc(this.currentUserId)
            .delete())
        toast.warn(`Removed ${this.currentPeerUser.nickname} from your crew`)
        this.props.history.push('/')
    }

    askReport = () => {
        this.setState({isOpenReportConfirm: true})
    }

    hideReport = () => {
        this.setState({isOpenReportConfirm: false})
    }

    askRemove = () => {
        this.setState({isOpenRemoveConfirm: true})
    }

    hideRemove = () => {
        this.setState({isOpenRemoveConfirm: false})
    }

    render() {
        return (
            <div className="viewChatBoard">
                {/* Header */}
                <div className="headerChatBoard">
                    <img
                        className="viewAvatarItemChat"
                        src={this.currentPeerUser.photoUrl}
                        alt="icon avatar"
                    />
                    <span className="textHeaderChatBoard">
                    {this.currentPeerUser.nickname}
                    </span>
                    <div className="dropdown">
                    <button className="dropbtn">Options</button>
                    <div className="dropdown-content">
                        <a onClick={this.askReport}>Report</a>
                        <a onClick={this.askRemove}>Remove</a>
                    </div>
                    </div>
                </div>

                {/* List message */}
                <div className="viewListContentChat">
                    < ListOfMessages 
                        listMessage = { this.listMessage }
                        currentUserId = { this.currentUserId }
                        currentPeerUser = { this.currentPeerUser }
                    />
                    <div
                        style={{float: 'left', clear: 'both'}}
                        ref={el => {
                            this.messagesEnd = el
                        }}
                    />
                </div>

                {/* Stickers */}
                {this.state.isShowSticker ? <StickerSelect onSendMessage={this.onSendMessage}/> : null}

                {/* View bottom */}
                <div className="viewBottom">
                    <img
                        className="icOpenGallery"
                        src={images.ic_photo}
                        alt="icon open gallery"
                        onClick={() => this.refInput.click()}
                    />
                    <input
                        ref={el => {
                            this.refInput = el
                        }}
                        accept="image/*"
                        className="viewInputGallery"
                        type="file"
                        onChange={this.onChoosePhoto}
                    />
                    <img
                        className="icOpenSticker"
                        src={images.ic_sticker}
                        alt="icon open sticker"
                        onClick={this.openListSticker}
                    />
                    <input
                        className="viewInput"
                        placeholder="Type your message..."
                        value={this.state.inputValue}
                        onChange={event => { this.setState({inputValue: event.target.value}) } }
                        onKeyPress={this.onKeyboardPress}
                    />
                    <img
                        className="icSend"
                        src={images.ic_send}
                        alt="icon send"
                        onClick={() => this.onSendMessage(this.state.inputValue, 0)}
                    />
                </div>

                {/* Dialog confirm */}
                {this.state.isOpenReportConfirm ? (
                    <Confirmation
                        text={`Are you sure you want to report and remove ${this.currentPeerUser.nickname}?`}
                        acceptFunction={() => this.report()}
                        rejectFunction={() => this.hideReport()}/>
                ) : null}

                {this.state.isOpenRemoveConfirm ? (
                    <Confirmation
                        text={`Are you sure you want to remove ${this.currentPeerUser.nickname}?`}
                        acceptFunction={() => this.remove()}
                        rejectFunction={() => this.hideRemove()}/>
                ) : null}

                {/* Loading */}
                {this.state.isLoading ? (
                    <div className="viewLoading">
                        <ReactLoading
                            type={'spin'}
                            color={'#203152'}
                            height={'3%'}
                            width={'3%'}
                        />
                    </div>
                ) : null}
            </div>
        )
    }
}