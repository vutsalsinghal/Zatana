import React, { Component } from 'react';
import {Loader, Dimmer, Message, Form, Input, Button, Dropdown} from 'semantic-ui-react';
import S3Client from 'aws-s3';
import SparkMD5 from 'spark-md5';
import axios from 'axios';
import configuration from '../config';
import web3 from '../ethereum/web3';
import ZatannaInstance from '../ethereum/Zatanna';
import {awsSigning} from '../utils.js'

const genreOptions = [
  {key:'country',text:'Country',value:'country'},
  {key:'classical',text:'Classical',value:'classical'},
  {key:'blues',text:'Blues',value:'blues'},
  {key:'dance',text:'Dance',value:'dance'},
  {key:'electronic',text:'Electronic',value:'electronic'},
  {key:'hiphop',text:'Hip-Hop',value:'hiphop'},
  {key:'rap',text:'Rap',value:'rap'},
  {key:'jazz',text:'Jazz',value:'jazz'},
  {key:'latin',text:'Latin',value:'latin'},
  {key:'opera',text:'Opera',value:'opera'},
  {key:'pop',text:'Pop',value:'pop'},
  {key:'rbsoul',text:'R&B/Soul',value:'rbsoul'},
  {key:'reggae',text:'Reggae',value:'reggae'},
  {key:'rock',text:'Rock',value:'rock'},
  {key:'metal',text:'Metal',value:'metal'}
]

var Buffer = require('buffer/').Buffer
class UploadSong extends Component {
  state = {
  name:'',
  cost:'',
  genre:'',
  role:'',
  songHash:'',
  actualSong:'',
  userAccount:'',
  loadingData:false,
  loading:false,
  errorMessage:'',
  msg:'',
  }

  async componentDidMount(){
    this.setState({loadingData:true});
    document.title = "Zatanna | Upload Song";

    try{
      const accounts = await web3.eth.getAccounts();
      const role = await ZatannaInstance.methods.getRole().call({from:accounts[0]});
      this.setState({role:role, userAccount:accounts[0]});

    }catch(err){
      console.log(err);
    }

    this.setState({loadingData:false});
    }

    fileCapture = (file) => {
    this.setState({errorMessage:'', loading:true, msg:'', name:file.name});

    if (typeof file !== 'undefined'){
      if (file.type.split('/')[0] === 'audio'){
      try{
        let reader = new window.FileReader()
        reader.readAsArrayBuffer(file)
        reader.onloadend = async () => {
          const buffer = Buffer.from(reader.result);
          var spark = new SparkMD5.ArrayBuffer();
          spark.append(buffer);
          let hash = spark.end();
          this.setState({songHash:hash.toString()});
        }

        const tmr = setInterval(() => {
        if (this.state.songHash === '') {
          // pass
        }else{
          clearInterval(tmr);
          this.checkUnique(file);
        }
        }, 1000);

      }catch(err){
        console.log("error: ",err.message);
      }
      }else{
      this.setState({errorMessage:'Not a audio file!'});
      this.setState({loading:false});
      }
    }else{
      this.setState({errorMessage:'No file selected!'});
      this.setState({loading:false});
    }
  }

  checkUnique = async (file) => {
    const isUnique = await ZatannaInstance.methods.songIsUnique(this.state.songHash).call({from: this.state.userAccount});
    if (parseInt(isUnique,10) === 0){
      this.setState({actualSong:file});
    }else{
      this.setState({errorMessage:"The song that you're uploading has already been uploaded. If this is not your song then keep in mind that piracy is a punishable offence!"})
    }

    this.setState({loading:false});
  }

  onSubmit = async (event) => {
    console.log(this.state.genre);
    event.preventDefault();

    this.setState({errorMessage:'', loading:true, msg:''});
    if (this.state.role === '1'){
      
      const config = {
        bucketName: 'zatanna-music-upload',
        region: 'us-east-1',
        accessKeyId: configuration.accessKeyId,
        secretAccessKey: configuration.secretAccessKey,
        dirName: 'songs',
      }
      
      try{
        await S3Client.uploadFile(this.state.actualSong, config); // Thanks to https://github.com/Fausto95/aws-s3
      }catch(err){
        this.setState({errorMessage:err.message, msg:''});
      }

      try{
        await ZatannaInstance.methods.artistUploadSong(this.state.cost,this.state.name, this.state.genre, this.state.songHash).send({from:this.state.userAccount});
        this.setState({msg:"Song Uploaded Successfully!"});
      }catch(err){
        // If error, delete the uploaded song from S3!

        let request = {
          'action':"deleteS3File",
          'bucket':"zatanna-music-upload",
          'key':"songs/"+this.state.name
        }

        let signedRequest = awsSigning(request,'v1/s3action');
        try{
          axios(signedRequest);
        }catch(e){
          console.log(e);
        }

        this.setState({errorMessage:err.message, msg:''});
      }
    }else{
      this.setState({errorMessage:"You're not registered as an Artist!"});
    }

    this.setState({loading:false});
  }

  render() {
  if(this.state.loadingData){
    return (
    <Dimmer active inverted>
      <Loader size='massive'>Loading...</Loader>
    </Dimmer>
    );
  }

  let statusMessage;

  if (this.state.msg === ''){
    statusMessage = null;
  }else{
    statusMessage = <Message floating positive header="Success!" content={this.state.msg} />;
  }

  return (
    <div>
      {this.state.role==='1' &&
        <div>  
          <h2>Upload Your Creation!</h2>
          <Form onSubmit={this.onSubmit} error={!!this.state.errorMessage}>
            <Form.Field width={10}>
              <label>Song file</label>
              <Input type='file' onChange={event => this.fileCapture(event.target.files[0])} />
            </Form.Field>
            <Form.Group>
              <Form.Field  width={5}>
                <label>Song Genre</label>
                <Dropdown placeholder='Choose a Genre' options={genreOptions} search selection onChange={(k,{value}) => this.setState({genre:value})} />
              </Form.Field>
              <Form.Field width={5}>
                <label>Song Cost</label>
                <Input 
                  label="wei"
                  labelPosition='right'
                  value={this.state.cost}
                  onChange={event => this.setState({cost: event.target.value})}
              />
              </Form.Field>
            </Form.Group><br/>
            <Button primary basic loading={this.state.loading}>
              Upload
            </Button>
            <Message error header="Oops!" content={this.state.errorMessage} />
            {statusMessage}
          </Form>
        </div>
      }

      {this.state.role!=='1' &&
        <h2>You are not registered as an Artist!</h2>
      }
    </div>);
  }
}

export default UploadSong;