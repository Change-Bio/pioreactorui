import React from "react";
import moment from "moment";
import { Client, Message } from "paho-mqtt";

import Grid from '@mui/material/Grid';
import { makeStyles } from '@mui/styles';
import FormGroup from '@mui/material/FormGroup';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/Card';
import {Typography} from '@mui/material';
import Button from "@mui/material/Button";
import Stepper from '@mui/material/Stepper';
import Step from '@mui/material/Step';
import StepLabel from '@mui/material/StepLabel';
import TextField from '@mui/material/TextField';
import Autocomplete, { createFilterOptions } from '@mui/material/Autocomplete';

//import CleaningScript from "./components/CleaningScript"
import StartSensors from "./components/StartSensors"
import StartCalculations from "./components/StartCalculations"


const useStyles = makeStyles((theme) => ({
  root: {
    marginTop: "15px"
  },
  cardContent: {
    padding: "10px"
  },
  button: {
    marginRight: theme.spacing(1),
  },
  instructions: {
    marginTop: theme.spacing(2),
    marginBottom: theme.spacing(4),
    marginLeft: "auto",
    marginRight: "auto",
    width: "60%"
  },
  textField:{
    marginTop: theme.spacing(1),
    marginBottom: theme.spacing(1),
    width: "100%"

  },
  formControl: {
    margin: theme.spacing(3),
  },
}));


const filter = createFilterOptions();

function FreeSoloCreateOption(props) {
  const classes = useStyles();
  const [value, setValue] = React.useState({key: props.value});
  const options = props.options
  const updateParentCallback = props.updateParentCallback

  React.useEffect( () => {
    setValue({key: props.value});
  }, [props.value]);

  return (
    <Autocomplete
      value={value}
      className={classes.textField}
      onChange={(event, newValue) => {
        if (typeof newValue === 'string') {
          setValue({
            key: newValue,
          });
          updateParentCallback(newValue)

        } else if (newValue && newValue.inputValue) {
          // Create a new value from the user input
          setValue({
            key: newValue.inputValue,
          });
          updateParentCallback(newValue.inputValue)

        } else {
          setValue(newValue);
          updateParentCallback(newValue?.key)
        }
      }}
      filterOptions={(options, params) => {
        const filtered = filter(options, params);

        const { inputValue } = params;
        // Suggest the creation of a new value
        const isExisting = options.some((option) => inputValue === option.key);
        if ((inputValue !== '') && !isExisting) {
          filtered.push({
            inputValue,
            key: `Add "${inputValue}"`,
          });
        }
        return filtered;
      }}
      selectOnFocus
      clearOnBlur
      handleHomeEndKeys
      id="free-solo-with-text-addition"
      options={options}
      getOptionLabel={(option) => {
        // Value selected with enter, right from the input
        if (typeof option === 'string') {
          return option;
        }
        // Add "xxx" option created dynamically
        if (option.inputValue) {
          return option.inputValue;
        }
        if (option.key){
          return option.key;
        }
        return ""
      }}
      renderOption={(props, option) => <li {...props}>{option.key}</li>}
      sx={{ width: 300 }}
      freeSolo
      renderInput={(params) => (
        <TextField {...params} label={props.label} />
      )}
    />
  );
}



function ExperimentSummaryForm(props) {
  const classes = useStyles();
  const [formError, setFormError] = React.useState(false);
  const [helperText, setHelperText] = React.useState("");
  const [expName, setExpName] = React.useState("");
  const [timestamp, setTimestamp] = React.useState(moment.utc());
  const [description, setDescription] = React.useState("");
  const [organismUsed, setOrganismUsed] = React.useState("");
  const [mediaUsed, setMediaUsed] = React.useState("");
  const [historicalMediaUsed, setHistoricalMediaUsed] = React.useState([]);
  const [historicalOrganismUsed, setHistoricalOrganismUsed] = React.useState([]);

  React.useEffect(() => {
    function populateDropDowns() {
      fetch("/get_historical_media_used")
        .then((response) => {
            if (response.ok) {
              return response.json();
            }
          })
        .then(json => setHistoricalMediaUsed(json))

      fetch("/get_historical_organisms_used")
        .then((response) => {
            if (response.ok) {
              return response.json();
            }
          })
        .then(json => setHistoricalOrganismUsed(json))
    }
    populateDropDowns();
  }, [])


  function publishExpNameToMQTT(){

    function onConnect() {
      var message = new Message(expName.trim());
      message.destinationName = "pioreactor/latest_experiment"
      message.qos = 1;
      message.retained = true;
      client.publish(message);
    }

    var client
    if (props.config.remote && props.config.remote.ws_url) {
      client = new Client(
        `ws://${props.config.remote.ws_url}/`,
        "webui_publishExpNameToMQTT" + Math.random()
      )}
    else {
      client = new Client(
        `${props.config['network.topology']['leader_address']}`, 9001,
        "webui_publishExpNameToMQTT" + Math.random()
      );
    }
    client.connect({ onSuccess: onConnect, timeout: 180});

  }

  function populateFields(){
    fetch("/get_latest_experiment")
      .then((response) => {
        return response.json();
      })
      .then((data) => {
        setExpName(data.experiment)
        setDescription(data.description)
        setOrganismUsed(data.organism_used)
        setMediaUsed(data.media_used)
      });
  }


  function killExistingJobs(){
     fetch('/stop_all', {method: "POST"})
  }

  function onSubmit(e) {
    e.preventDefault();
    if (expName === ""){
      setFormError(true)
      setHelperText("Can't be blank.")
      return
    }
    else if (expName.includes("#") || expName.includes("+") || expName.includes("/")) {
      setFormError(true)
      setHelperText("Can't use #, / or + characters in experiment name.")
      return
    }

    // TODO: confirm we are connected to MQTT

    fetch('create_experiment',{
        method: "POST",
        body: JSON.stringify({experiment : expName.trim(), timestamp: timestamp.toISOString(), description: description, mediaUsed: mediaUsed, organismUsed: organismUsed }),
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json'
        }
      }).then(res => {
        if (res.status === 200){
          publishExpNameToMQTT()
          setHelperText("")
          setFormError(false);
          killExistingJobs()
          props.handleNext()
        }
        else{
          setFormError(true);
          setHelperText("Experiment name already used.")
        }
      }
     )
  }

  const onExpNameChange = (e) => {
    setExpName(e.target.value)
  }
  const onDescChange = (e) => {
    setDescription(e.target.value)
  }
  const onTimestampChange = (e) => {
    setTimestamp(e.target.value)
  }
  return (
    <div className={classes.root}>
        <FormGroup>
        <Grid container spacing={1}>
          <Grid item xs={12} md={6}>
            <TextField
              error={formError}
              id="expName"
              label="Experiment name"
              value={expName}
              required
              className={classes.textField}
              onChange={onExpNameChange}
              helperText={helperText}
              />
          </Grid>
          <Grid item xs={12} md={6}>
            <TextField
              id="datetime"
              label="Start time"
              type="datetime-local"
              defaultValue={timestamp.local().format("YYYY-MM-DDTHH:mm:ss")}
              className={classes.textField}
              onChange={onTimestampChange}
              InputLabelProps={{
                shrink: true,
              }}
            />
          </Grid>
          <Grid item xs={12} md={12}>
            <TextField
              label="Description (optional)"
              maxRows={4}
              placeholder={"Add a description: what is your hypothesis? What is the experiment protocol? This description can always be changed later."}
              multiline
              value={description}
              className={classes.textField}
              onChange={onDescChange}
              fullWidth={true}
            />
          </Grid>

          <Grid item xs={12} md={6}>
            <FreeSoloCreateOption
              options={historicalOrganismUsed}
              label="Organism / strain (optional)"
              updateParentCallback={setOrganismUsed}
              value={organismUsed}
            />
          </Grid>
          <Grid item xs={12} md={6}>
            <FreeSoloCreateOption
              options={historicalMediaUsed}
              label="Media (optional)"
              updateParentCallback={setMediaUsed}
              value={mediaUsed}
            />
          </Grid>



          <Grid item xs={12} md={4}/>
          <Grid item xs={12} md={8}>
            <div style={{display: "flex", justifyContent: "flex-end"}}>
              <Button style={{marginRight: "10px"}} size="small" color="primary" onClick={populateFields}>Populate with previous experiment</Button>
              <Button variant="contained" color="primary" onClick={onSubmit}> Create </Button>
            </div>
          </Grid>
        </Grid>
        </FormGroup>
    </div>
  );
}





function StartNewExperimentContainer(props) {
  const classes = useStyles();
  const [activeStep, setActiveStep] = React.useState(0);
  const [skipped, setSkipped] = React.useState(new Set());

  const getStepContent = (index) => {
    return steps[index].content
  }
  const isStepOptional = (index) => {
    return steps[index].optional
  };

  const isStepSkipped = (step) => {
    return skipped.has(step);
  };

  const handleNext = () => {
    if (activeStep === steps.length - 1){
      window.location.href = "/overview";
    } else {

      let newSkipped = skipped;
      if (isStepSkipped(activeStep)) {
        newSkipped = new Set(newSkipped.values());
        newSkipped.delete(activeStep);
      }

      setActiveStep((prevActiveStep) => prevActiveStep + 1);
      setSkipped(newSkipped);
      window.scrollTo({top: 0})
    }
  };

  const handleBack = () => {
    setActiveStep((prevActiveStep) => prevActiveStep - 1);
  };

  const handleSkip = () => {
    if (!isStepOptional(activeStep)) {
      throw new Error("You can't skip a step that isn't optional.");
    }

    setActiveStep((prevActiveStep) => prevActiveStep + 1);
    setSkipped((prevSkipped) => {
      const newSkipped = new Set(prevSkipped.values());
      newSkipped.add(activeStep);
      return newSkipped;
    });
  };

  const handleReset = () => {
    setActiveStep(0);
  };

  const steps = [
    {title: 'Experiment summary', content: <ExperimentSummaryForm config={props.config} handleNext={handleNext}/>, optional: false},
    //{title: 'Cleaning and preparation', content: <CleaningScript config={props.config}/>, optional: true},
    {title: 'Start sensors', content: <StartSensors config={props.config}/>, optional: false},
    {title: 'Start calculations', content: <StartCalculations config={props.config}/>, optional: false},
  ];

  return (
    <Card className={classes.root}>
      <CardContent className={classes.cardContent}>
        <Typography variant="h5" component="h1">
          Start a new experiment
        </Typography>
        <Stepper activeStep={activeStep}>
          {steps.map((step, index) => {
            const stepProps = {};
            const labelProps = {};
            if (step.optional) {
              labelProps.optional = <Typography variant="caption">Optional</Typography>;
            }
            if (isStepSkipped(index)) {
              stepProps.completed = false;
            }
            return (
              <Step key={step.title} {...stepProps}>
                <StepLabel {...labelProps}>{step.title}</StepLabel>
              </Step>
            );
          })}
        </Stepper>
        <div>
          {activeStep === steps.length ? (
            <div>
              <Typography className={classes.instructions}>
                All steps completed - you're finished
              </Typography>
              <Button onClick={handleReset} className={classes.button}>
                Reset
              </Button>
            </div>
          ) : (
            <div>
              <Typography className={classes.instructions}>{getStepContent(activeStep)}</Typography>
              <div>
                <Button disabled={activeStep === 0} onClick={handleBack} className={classes.button}>
                  Back
                </Button>
                {isStepOptional(activeStep) && (
                  <Button
                    variant="contained"
                    onClick={handleSkip}
                    className={classes.button}
                  >
                    Skip
                  </Button>
                )}

                <Button
                  variant="contained"
                  onClick={handleNext}
                  className={classes.button}
                >
                  {activeStep === steps.length - 1 ? 'Go to overview' : 'Next'}
                </Button>
              </div>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  )
}



function StartNewExperiment(props) {
    React.useEffect(() => {
      document.title = props.title;
    }, [props.title])
    return (
        <Grid container spacing={2} >
          <Grid item xs={12} md={12}>
            <StartNewExperimentContainer config={props.config}/>
          </Grid>
        </Grid>
    )
}

export default StartNewExperiment;

