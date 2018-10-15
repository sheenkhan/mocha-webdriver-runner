import { MochaWebdriverReporter } from "./mocha-webdriver-reporter";
import { fetchPageCommand, emitPageEvent } from "./page-event-queue";
import { serialize } from "@zbigg/treesync";
import { Options } from "./mocha-webdriver-runner";

export { MochaWebdriverReporter as Reporter } from "./mocha-webdriver-reporter";
export { emitPageEvent } from "./page-event-queue";

/**
 * Setups `mocha` instance to send events to
 *  - use [[MochaWebdriverReporter]]
 *  - receive options form `mocha-webdriver-runner`
 *
 * Usage:
 *
 *     mocha.setup(...);
 *     MochaWebdriverClient.install(mocha);
 *     // load tests
 *     mocha.run(...);
 *
 * @param mocha
 */
export function install(mocha: Mocha) {
    mocha.reporter(MochaWebdriverReporter as any);
    const originalMochaRun = mocha.run;

    mocha.globals(["__pageEventQueue", "__pageEventCallback", "__driverCommandCallback", "__driverCommandQueue"]);

    mocha.run = function(fn?: ((failures: number) => void | undefined)): Mocha.Runner {
        // TODO: really hacky solution, rewrite somehow
        function doStartMocha(options: Options) {
            console.log("mocha-webdriver-client: starting mocha with options", options);
            if (options.grep) {
                mocha.grep(options.grep);
            }
            if (options.captureConsoleLog) {
                installConsoleLogSender();
            }
            originalMochaRun.call(mocha, fn);
        }
        function processCommand(command: any) {
            if ((command.type == "start-mocha-tests", command.mochaOptions)) {
                doStartMocha(command.mochaOptions);
            } else {
                fetchPageCommand().then(processCommand);
            }
        }
        fetchPageCommand().then(processCommand);

        return undefined!;
    };
}

function installConsoleLogSender() {
    const originalConsole = {
        log: console.log,
        info: console.info,
        warn: console.warn,
        error: console.error
    };

    function pageEventLogger(level: "log" | "info" | "warn" | "error") {
        return function(...args: any[]) {
            originalConsole[level].apply(console, args);
            emitPageEvent({ type: "log", level, args: serialize(args) });
        };
    }

    console.log = pageEventLogger("log");
    console.info = pageEventLogger("info");
    console.warn = pageEventLogger("warn");
    console.error = pageEventLogger("error");
}