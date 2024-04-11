import { ViewDocIcon } from "assets/icons";
import {
  ArrayControl,
  BoolCodeControl,
  FunctionControl,
  RadiusControl,
  StringControl
} from "comps/controls/codeControl";
import { dropdownControl, LeftRightControl } from "comps/controls/dropdownControl";
import { IconControl } from "comps/controls/iconControl";
import { MultiCompBuilder, valueComp, withContext, withDefault } from "comps/generators";
import { list } from "comps/generators/list";
import { ToViewReturn } from "comps/generators/multi";
import { genRandomKey } from "comps/utils/idGenerator";
import { disabledPropertyView, hiddenPropertyView } from "comps/utils/propertyUtils";
import { trans } from "i18n";
import _, { mapValues } from "lodash";
import {
  Comp,
  CompAction,
  CompActionTypes,
  CompParams,
  ConstructorToDataType,
  ConstructorToView,
  fromRecord,
  MultiBaseComp,
  withFunction,
} from "lowcoder-core";
import {
  AutoArea,
  CompressIcon,
  controlItem,
  ExpandIcon,
  IconRadius,
  Option,
  WidthIcon,
  ImageCompIcon,
} from "lowcoder-design";
import styled from "styled-components";
import { lastValueIfEqual } from "util/objectUtils";
import { getNextEntityName } from "util/stringUtils";
import { JSONObject, JSONValue } from "util/jsonTypes";
import { ButtonEventHandlerControl } from "./eventHandlerControl";
import { ControlItemCompBuilder } from "comps/generators/controlCompBuilder";
import { ColorControl } from "./colorControl";
import { StringStateControl } from "./codeStateControl";
import { reduceInContext } from "../utils/reduceContext";
import { optionsControl } from "lowcoder-sdk";
import type { TourProps as AntdTourProps } from 'antd';
import { useRef, useState } from "react";
import { EditorState } from "@lowcoder-ee/comps/editorState";
import { executeCompAction } from "@lowcoder-ee/comps/controls/actionSelector/executeCompAction";
import { TargetCompAction } from "@lowcoder-ee/comps/comps/tourComp/componentSelectorControl";

const OptionTypes = [
  {
    label: trans("prop.manual"),
    value: "manual",
  },
  {
    label: trans("prop.map"),
    value: "map",
  },
] as const;

// All options must contain label
type OptionChildType = { label: InstanceType<typeof StringControl> };
type TourControlType = new (params: CompParams<any>) => MultiBaseComp<
  OptionChildType,
  any,
  any
> &
  Comp<any, any, any>;
type OptionControlParam = {
  // list title
  title?: string;
  // The new option's label name
  newOptionLabel?: string;
};

type OptionPropertyParam = {
  autoMap?: boolean;
};

interface TourStepCompProperty {
  propertyView(param: OptionPropertyParam): React.ReactNode;
}

function hasPropertyView(comp: any): comp is TourStepCompProperty {
  return !!(comp as any).propertyView;
}

// Add dataIndex to each comp, required for drag and drop sorting
function withDataIndex<T extends TourStepControlType>(VariantComp: T) {
  // @ts-ignore
  class WithDataIndexComp extends VariantComp {
    dataIndex: string = genRandomKey();

    getDataIndex() {
      return this.dataIndex;
    }
  }

  return WithDataIndexComp as new (
    params: CompParams<ConstructorToDataType<T>>
  ) => WithDataIndexComp;
}

// Deduplication, the same value takes the first one
function distinctValue<T extends ToViewReturn<OptionChildType>>(data: T[], uniqField: keyof T) {
  if (!data || data.length <= 0) {
    return data;
  }
  const result: T[] = [];
  data.reduce((uniqValSet, item) => {
    const uniqVal = item[uniqField];
    if (!uniqValSet.has(uniqVal)) {
      result.push(item);
    }
    uniqValSet.add(uniqVal);
    return uniqValSet;
  }, new Set());
  return result;
}

type PickNumberFields<T> = {
  [key in keyof T]: T[key] extends number ? T[key] : never;
};

// Manually add options
export function manualTourStepsControl<T extends TourStepControlType>(
  VariantComp: T,
  config: {
    // init value
    initOptions?: ConstructorToDataType<T>[];
    // Unique value field, used to deduplicate
    uniqField?: keyof ConstructorToView<T>;
    // auto-increment field
    autoIncField?: keyof PickNumberFields<ConstructorToView<T>>;
  }
) {
  type OptionDataType = ConstructorToDataType<T>;
  const ManualComp = list(withDataIndex(VariantComp));
  const TmpManualOptionControl = new MultiCompBuilder(
    {
      manual: ManualComp,
    },
    (props) => {
      const view = props.manual.map((m) => m.getView());
      return config.uniqField ? distinctValue(view, config.uniqField) : view;
    }
  )
    .setPropertyViewFn(() => {
      throw new Error("Method not implemented.");
    })
    .build();

  class ManualOptionControl extends TmpManualOptionControl {
    exposingNode() {
      return withFunction(
        fromRecord(
          mapValues(this.children.manual.children, (c1) =>
            fromRecord(mapValues(c1.children, (c2) => c2.exposingNode()))
          )
        ),
        (params) => Object.values(params)
      );
    }

    private getNewId(): number {
      const { autoIncField } = config;
      if (!autoIncField) return 0;
      const view = this.children.manual.getView().map((m) => m.getView());
      const ids = new Set(view.map((tab) => tab[autoIncField]));
      let id = 0;
      while (ids.has(id)) ++id;
      return id;
    }

    propertyView(param: OptionControlParam) {
      const manualComp = this.children.manual;
      const { autoIncField } = config;
      const title = param.title ?? trans("optionsControl.optionList");

      return controlItem(
        { filterText: title },
        <Option
          itemTitle={(comp) => comp.children.title.getView()}
          popoverTitle={() => trans("edit")}
          content={(comp) => {
            return hasPropertyView(comp) ? comp.propertyView({}) : comp.getPropertyView();
          }}
          items={manualComp.getView()}
          onAdd={() => {
            const label = getNextEntityName(
              param.newOptionLabel || trans("optionsControl.option") + " ",
              manualComp.getView().map((m) => m.children.title.getView())
            );
            const id = this.getNewId();
            manualComp.dispatch(
              manualComp.pushAction({
                label: label,
                ...(autoIncField ? { [autoIncField]: id } : {}),
              } as OptionDataType)
            );
          }}
          onDel={(i) => manualComp.dispatch(manualComp.deleteAction(i))}
          onCopy={(comp) => {
            const id = this.getNewId();
            manualComp.dispatch(
              manualComp.pushAction({
                ...comp.toJsonValue(),
                ...(autoIncField ? { [autoIncField]: id } : {}),
              })
            );
          }}
          onMove={(fromIndex, toIndex) => {
            const action = manualComp.arrayMoveAction(fromIndex, toIndex);
            manualComp.dispatch(action);
          }}
          dataIndex={(comp) => comp.getDataIndex()}
          uniqVal={
            config.uniqField && ((comp) => (comp.children as any)[config.uniqField].getView())
          }
          title={title}
        />
      );
    }
  }

  return config.initOptions
    ? withDefault(ManualOptionControl, { manual: config.initOptions })
    : ManualOptionControl;
}

const TipLabel = styled.p`
  display: inline;
  margin: 2px 0 0 0;
  padding: 0;

  font-size: 13px;
  color: #9195a3;
  line-height: 18px;
  cursor: pointer;

  :hover g g {
    stroke: #315efb;
  }
`;
const DocIcon = styled(ViewDocIcon)`
  transform: translateY(1px);
  margin-right: 6px;
`;

const optionListDocUrl = trans("docUrls.optionList");
const OptionTip = optionListDocUrl ? (
  <TipLabel onClick={() => window.open(optionListDocUrl)}>
    <DocIcon title={trans("optionsControl.viewDocs")} />
    {trans("optionsControl.tip")}
  </TipLabel>
) : (
  <></>
);

// auto mapping
export function mapOptionsControl<T extends TourControlType>(
  VariantComp: T,
  uniqField?: keyof ConstructorToView<T>
) {
  // @ts-ignore
  class TempComp extends VariantComp {
    override getPropertyView() {
      return hasPropertyView(this) ? this.propertyView({ autoMap: true }) : super.getPropertyView();
    }
  }

  const MapDataComp = withContext(TempComp, ["item", "i"] as const);
  const label = trans("data");
  const TmpOptionControl = new ControlItemCompBuilder(
    {
      data: withDefault(ArrayControl, "[]"),
      mapData: MapDataComp,
    },
    (props) => {
      const view = props.data.map((d, i) => {
        return props.mapData({
          item: d,
          i: i,
        });
      });
      return uniqField ? distinctValue(view, uniqField) : view;
    }
  )
    .setControlItemData({ filterText: label })
    .setPropertyViewFn((children) => (
      <>
        {children.data.propertyView({ label })}
        <AutoArea>
          {children.mapData.getPropertyView()}
          {OptionTip}
        </AutoArea>
      </>
    ))
    .build();

  return class extends TmpOptionControl {
    private lastDataExample: any = {};

    exposingNode() {
      const nd = withFunction(
        fromRecord({
          data: this.children.data.exposingNode(),
          mapData: this.children.mapData.node(),
        }),
        (params) =>
          params.data.map((d: any, i) =>
            mapValues((params.mapData as any)({ item: d }), (v) => v.value)
          )
      );
      return lastValueIfEqual(
        this,
        "exposingNode",
        [nd, this] as const,
        (a, b) => a[1] === b[1]
      )[0];
    }

    override reduce(action: CompAction) {
      // TODO: temporary solution condition to fix context issue in dropdown option's events
      if (
        action.type === CompActionTypes.CUSTOM
        && (action.value as JSONObject).type === 'actionTriggered'
      ) {
        const comp = reduceInContext({ inEventContext: true }, () => super.reduce(action));
        return comp;
      } else
      if (action.type === CompActionTypes.UPDATE_NODES_V2) {
        const comp = super.reduce(action)
        if (comp.children.data !== this.children.data) {
          const sourceArray = comp.children.data.getView();
          const dataExample = sourceArray ? sourceArray[0] : undefined;
          if (dataExample && !_.isEqual(comp.lastDataExample, dataExample)) {
            comp.lastDataExample = dataExample;
            return comp.updateContext(dataExample);
          }
        }
        return comp;
      }
      return super.reduce(action);
    }

    updateContext(dataExample: JSONValue) {
      return this.setChild(
        "mapData",
        this.children.mapData.reduce(
          MapDataComp.changeContextDataAction({
            item: dataExample,
            i: 0,
          })
        )
      );
    }
  };
}

type TourStepChildType = { 
  // target: InstanceType<typeof TargetCompAction>,
  // target: InstanceType<typeof FunctionControl>,
  title: InstanceType<typeof StringControl>,
};
type TourStepControlType = new (params: CompParams<any>) => MultiBaseComp<
  TourStepChildType,
  any,
  any
> &
  Comp<any, any, any>;

export function tourStepsControl<T extends TourStepControlType>(
  VariantComp: T,
  config: {
    // init value
    initOptions?: ConstructorToDataType<T>[];
    // manual mode list title
    title?: string;
  }
) {
  type OptionViewType = ConstructorToView<T>;

  const TmpOptionControl = new MultiCompBuilder(
    {
      optionType: dropdownControl(OptionTypes, "manual"),
      manual: manualTourStepsControl(VariantComp, {
        initOptions: config.initOptions,
      }),
    },
    (props): OptionViewType[] => {
      return props.manual;
    }
  )
    .setPropertyViewFn(() => {
      throw new Error("Method not implemented.");
    })
    .build();

  return class extends TmpOptionControl {
    exposingNode() {
      return this.children.manual.exposingNode();
    }

    propertyView(param: OptionControlParam) {
      const item = this.children.manual.propertyView(param);
      return controlItem(
        { searchChild: true },
        <>
          {this.children.optionType.propertyView({
            radioButton: true,
            type: "oneline",
          })}
          {item}
        </>
      );
    }
  };
}

const PlacementOptions = [
  { label: "Center", value: "center"},
  { label: "Left", value: "left"},
  { label: "LeftTop", value: "leftTop"},
  { label: "LeftBottom", value: "leftBottom"},
  { label: "Right", value: "right"},
  { label: "RightTop", value: "rightTop"},
  { label: "RightBottom", value: "rightBottom"},
  { label: "Top", value: "top"},
  { label: "TopLeft", value: "topLeft"},
  { label: "TopRight", value: "topRight"},
  { label: "Bottom", value: "bottom"},
  { label: "BottomLeft", value: "bottomLeft"},
  { label: "BottomRight", value: "bottomRight"},
];


let TourStep = new MultiCompBuilder(
  {
    target: TargetCompAction,
    // target: FunctionControl,
    arrow: BoolCodeControl,
    title: StringControl,
    description: StringControl,
    placement: dropdownControl(PlacementOptions, "center"),
    hidden: BoolCodeControl,
  },
  (props) => props
).build();

TourStep = class extends TourStep implements TourStepCompProperty {
  propertyView(param: { autoMap?: boolean }) {
    return (
      <>
        {this.children.title.propertyView({
          label: "Title",
          placeholder: "Welcome",
        })}
        {this.children.description.propertyView({
          label: "Description",
          placeholder: "Welcome to lowcoder, this is your first tutorial step",
        })}
        {this.children.target.propertyView()}
        {hiddenPropertyView(this.children)}
      </>
    );
  }
};

export const TourStepControl = tourStepsControl(TourStep, {
  initOptions: [
    { title: "BLAHHH", description: "I love tutorials" },
    { title: "second title", description: "Because they mean I don't have to teach people" },
  ],
});

let SelectInputOption = new MultiCompBuilder(
  {
    value: StringControl,
    label: StringControl,
    disabled: BoolCodeControl,
    hidden: BoolCodeControl,
  },
  (props) => props
).build();


SelectInputOption = class extends SelectInputOption implements TourStepCompProperty {
  propertyView(param: { autoMap?: boolean }) {
    return (
      <>
        {this.children.label.propertyView({
          label: trans("label"),
          placeholder: param.autoMap ? "{{item}}" : "",
        })}
        {this.children.value.propertyView({ label: trans("value") })}
        {disabledPropertyView(this.children)}
        {hiddenPropertyView(this.children)}
      </>
    );
  }
};

export const SelectInputOptionControl = optionsControl(SelectInputOption, {
  initOptions: [
    { label: trans("optionsControl.optionI", { i: 1 }), value: "1" },
    { label: trans("optionsControl.optionI", { i: 2 }), value: "2" },
  ],
  uniqField: "value",
});

