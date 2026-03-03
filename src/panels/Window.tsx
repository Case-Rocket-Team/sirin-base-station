import React from "react";

type Props = {
  children: React.ReactNode;
  width?: number;
  height?: number;
  x?: number;
  y?: number;
};

export default function Window({
  children,
  width = 300,
  height = 200,
  x = 50,
  y = 50,
}: Props) {
  return (
    <div
      style={{
        position: "absolute",
        left: x,
        top: y,
        width,
        height,
      }}
    >
      {children}
    </div>
  );
}