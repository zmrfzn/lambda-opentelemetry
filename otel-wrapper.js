const { NodeTracerProvider } = require("@opentelemetry/sdk-trace-node");
const { registerInstrumentations } = require("@opentelemetry/instrumentation");

const {
  getNodeAutoInstrumentations,
} = require("@opentelemetry/auto-instrumentations-node");
const { BatchSpanProcessor } = require("@opentelemetry/sdk-trace-base");

const { Resource } = require("@opentelemetry/resources");
const {
  SemanticResourceAttributes,
} = require("@opentelemetry/semantic-conventions");

const {
  OTLPTraceExporter,
} = require("@opentelemetry/exporter-trace-otlp-proto");

const {
  CompositePropagator,
  W3CBaggagePropagator,
  W3CTraceContextPropagator,
} = require("@opentelemetry/core");

// For troubleshooting, set the log level to DiagLogLevel.DEBUG
const { diag, DiagConsoleLogger, DiagLogLevel } = require("@opentelemetry/api");
// var logger = diag.createComponentLogger(DiagLogLevel.WARN);
diag.setLogger(new DiagConsoleLogger(), DiagLogLevel.WARN);

const COLLECTOR_STRING = `${process.env.OTEL_EXPORTER_OTLP_ENDPOINT}/v1/traces`;

// logger.error(`string: ${COLLECTOR_STRING}`);

/**
 * The `newRelicExporter` is an instance of OTLPTraceExporter
 * configured to send traces to New Relic's OTLP-compatible backend.
 * Make sure you have added your New Relic Ingest License to NR_LICENSE env-var
 */
const newRelicExporter = new OTLPTraceExporter({
  url: COLLECTOR_STRING,
  headers: {
    "api-key": `${process.env.NR_LICENSE}`,
  },
});

const provider = new NodeTracerProvider({
  resource: new Resource({
    [SemanticResourceAttributes.SERVICE_NAME]: process.env.OTEL_SERVICE_NAME,
  }),
});
provider.addSpanProcessor(
  new BatchSpanProcessor(
    newRelicExporter,
    //Optional BatchSpanProcessor Configurations
    {
      // The maximum queue size. After the size is reached spans are dropped.
      maxQueueSize: 1000,
      // The maximum batch size of every export. It must be smaller or equal to maxQueueSize.
      maxExportBatchSize: 500,
      // The interval between two consecutive exports
      scheduledDelayMillis: 500,
      // How long the export can run before it is canceled
      exportTimeoutMillis: 30000,
    }
  )
);
provider.register({
  propagator: new CompositePropagator({
    propagators: [new W3CBaggagePropagator(), new W3CTraceContextPropagator()],
  }),
});

registerInstrumentations({
  instrumentations: [
    getNodeAutoInstrumentations({
      "@opentelemetry/instrumentation-fs": {
        enabled: process.env.ENABLE_FS_INSTRUMENTATION,
        requireParentSpan: true,
      },
      "@opentelemetry/instrumentation-koa": {
        enabled: true,
      },
      "@opentelemetry/instrumentation-aws-lambda": {
        enabled: true,
        disableAwsContextPropagation: true,
        requestHook: (span, { event, context }) => {
          span.setAttribute("faas.name", context.functionName);

          if (event.requestContext && event.requestContext.http) {
            span.setAttribute(
              "faas.http.method",
              event.requestContext.http.method
            );
            span.setAttribute(
              "faas.http.target",
              event.requestContext.http.path
            );
          }

          if (event.queryStringParameters)
            span.setAttribute(
              "faas.http.queryParams",
              JSON.stringify(event.queryStringParameters)
            );
          // span.setAttribute("faas.event_dump", JSON.stringify(event));
          // span.setAttribute("faas.context_dump", JSON.stringify(context));
          // console.log(`CONTEXT DUMP: ${JSON.stringify(context)}`);
        },
        responseHook: (span, { err, res }) => {
          if (err instanceof Error)
            span.setAttribute("faas.error", err.message);
          if (res) {
            span.setAttribute("faas.http.status_code", res.statusCode);
            //   console.log(`RESPONSE HOOK: ${JSON.stringify(res)}`);
          }
        },
      },
    }),
  ],
});
