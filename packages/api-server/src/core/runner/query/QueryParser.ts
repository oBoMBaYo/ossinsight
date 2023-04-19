import {ConditionalRefreshCrons, QuerySchema} from "../../../types/query.schema";

export enum ParamTypes {
    ARRAY = 'array',
    STRING = 'string',
    NUMBER = 'number',
    BOOLEAN = 'boolean',
}

export enum ParamItemTypes {
    STRING = 'string',
    NUMBER = 'number',
    BOOLEAN = 'boolean',
}

export type ParamType = `${ParamTypes}`;

export type ParamItemType = `${ParamItemTypes}`;

export class BadParamsError extends Error {
    readonly msg: string
    constructor(public readonly name: string, message: string) {
        super(message);
        this.msg = message
    }
}

export class QueryParser {

    constructor() {}

    async parse(templateSQL: string, queryConfig: QuerySchema, values: Record<string, any>) {
        for (const param of queryConfig.params) {
            const {
                name,
                replaces,
                template,
                default: defaultValue,
                type = ParamTypes.STRING,
                pattern,
                itemType,
                maxArrayLength
            } = param;
            const value = values[name] ?? defaultValue;
    
            let replaceValue;
            if (type === ParamTypes.ARRAY) {
                replaceValue = this.processArrayValue(name, value, pattern, template, itemType, maxArrayLength);
            } else {
                replaceValue = this.verifyParamValue(name, value, pattern, template);
            }

            templateSQL = templateSQL.replaceAll(replaces, replaceValue);
        }
        return templateSQL
    }

    private processArrayValue(
      name: string, values: any | any[], pattern?: string, paramTemplate?: Record<string, string>,
      itemType: ParamItemType = ParamItemTypes.STRING, maxArrayLength: number = 10
    ): string {
        const arrayValue = Array.isArray(values) ? values : [values];

        if (arrayValue.length > maxArrayLength) {
            throw new BadParamsError(name, `The length of the array ${name} is too long (max length: ${maxArrayLength}).`);
        }

        return arrayValue
          .map((itemValue) => {
              return this.verifyParamValue(name, itemValue, pattern, paramTemplate);
          })
          .map((itemValue) => {
              return this.stringifyParamValue(itemType, itemValue);
          }).join(', ');
    }

    private verifyParamValue(name: string, value: any, pattern?: string, paramTemplate?: Record<string, string>) {
        // All parameters are required by default.
        if (!value) {
            throw new BadParamsError(name, `The parameter ${name} is undefined.`);
        }

        if (pattern) {
            const regexp = new RegExp(pattern);
            if (!regexp.test(String(value))) {
                throw new BadParamsError(name, `The data format of the parameter ${name} is incorrect (value: ${value}).`);
            }
        }

        // TODO: extract it to a function named `mappingParamValue`
        const targetValue = paramTemplate ? paramTemplate[String(value)] : value;
        if (targetValue === undefined || targetValue === null) {
            throw new BadParamsError(name, 'require param ' + name + (paramTemplate ? ` template value '${value}' not found` : ''))
        }

        return targetValue;
    }

    private stringifyParamValue(type: ParamType, value: any): string {
        switch (type) {
            case ParamItemTypes.STRING:
                return `'${value}'`;
            case ParamItemTypes.NUMBER:
                return `${value}`;
            case ParamItemTypes.BOOLEAN:
                return value ? '1' : '0';
            default:
                throw new Error('unknown param type ' + type);
        }
    }

    resolveCrons(params: any, crons: string | ConditionalRefreshCrons | undefined): (string | undefined) {
        if (typeof crons === "string") {
            return crons;
        }
        if (!crons) {
            return undefined;
        }
        if (!params || !params[crons.param]) {
            return undefined;
        }
        const param = params[crons.param];
        for (const key in crons.on) {
            // equals or matches
            if (param === key || (new RegExp(key)).test(param)) {
                return crons.on[key];
            }
        }
        return undefined;
    }

}