var fs=require('fs')
var _=require('lodash')
var Promise=require('bluebird')
var rollback=require('./rollback')
var build=require('./build').build

module.exports=Object.assign(
    rollback,
    build("Inference","createModel"),
    {"getModelConfig":{
        Type:"Task",
        Resource:"${LambdaVariables.ModelConfig}",
        ResultPath:"$.args.model",
        Next:"IfBuildInference"
    },
    "createModel":{
        Type:"Task",
        Resource:"${StepLambdaCreateModel.Arn}",
        ResultPath:"$.outputs.models",
        Next:"getEndpointConfig"
    },
    "getEndpointConfig":{
        Type:"Task",
        InputPath:"$",
        Resource:"${LambdaVariables.EndpointConfig}",
        ResultPath:"$.args.endpoint",
        Next:"createEndpointConfig"
    },
    "createEndpointConfig":{
        Type:"Task",
        Resource:"${StepLambdaCreateEndpointConfig.Arn}",
        ResultPath:"$.outputs.endpoint",
        Next:"updateEndpoint"
    },
    "updateEndpoint":{
        Type:"Task",
        Resource:"${StepLambdaUpdateEndpoint.Arn}",
        ResultPath:"$.outputs.deploy",
        Next:"waitForEndpoint"
    },
    "waitForEndpoint":{
        Type:"Wait",
        Seconds:10,
        Next:"endpointStatus"
    },
    "endpointStatus":{
        Type:"Task",
        Resource:"${StepLambdaEndpointStatus.Arn}",
        ResultPath:"$.status.endpoint",
        Next:"endpointCheck"
    },
    "endpointCheck":{
        Type:"Choice",
        Choices:[{
            Or:[{
                Variable:`$.status.endpoint.EndpointStatus`,
                StringEquals:"Creating",
            },{
                Variable:`$.status.endpoint.EndpointStatus`,
                StringEquals:"Updating",
            },{
                Variable:`$.status.endpoint.EndpointStatus`,
                StringEquals:"RollingBack",
            }],
            Next:`waitForEndpoint` 
        },{
            Or:[{
                Variable:`$.status.endpoint.EndpointStatus`,
                StringEquals:"InService",
            }],
            Next:`DeployStatus` 
        }],
        Default:`rollback`
    },
    "DeployStatus":{
        Type:"Task",
        Resource:"${StepLambdaDeployCheck.Arn}",
        ResultPath:"$.status.deployment",
        Next:"DeployCheck"
    },
    "DeployCheck":{
        Type:"Choice",
        Choices:[{
            Variable:`$.status.deployment`,
            BooleanEquals:true,
            Next:`IfPostProcess` 
        },{
            Variable:`$.status.deployment`,
            BooleanEquals:false,
            Next:`rollback` 
        }],
        Default:`rollback`
    },
    "endpointFail":{
        Type:"Task",
        Resource:"${StepLambdaNotificationFail.Arn}",
        Next:"Fail"
    },
})

