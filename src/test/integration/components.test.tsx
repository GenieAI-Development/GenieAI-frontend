import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { ReplyChips } from "@/genie-ai/components/ReplyChips";
import { Drawer } from "@/genie-ai/v3/Drawer";
import { ProductDialog } from "@/genie-ai/v3/ProductDialog";

describe("interactive UI components", () => {
  it("renders localized reply chips and reports selection", () => {
    const onSelect = vi.fn();
    const { rerender } = render(<ReplyChips chips={["More", "Compare"]} getLabel={(chip) => `Label: ${chip}`} onSelect={onSelect} />);
    fireEvent.click(screen.getByRole("button", { name: "Label: More" }));
    expect(onSelect).toHaveBeenCalledWith("More");
    rerender(<ReplyChips chips={[]} getLabel={(chip) => chip} onSelect={onSelect} />);
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });

  it("opens a modal drawer and closes from either close control", () => {
    const onClose = vi.fn();
    render(<Drawer open title="Preferences" icon="settings" onClose={onClose}><p>Drawer content</p></Drawer>);
    expect(screen.getByRole("dialog", { name: "Preferences" })).toBeInTheDocument();
    expect(screen.getByText("Drawer content")).toBeInTheDocument();
    const closeButtons = screen.getAllByRole("button", { name: "Close Preferences" });
    fireEvent.click(closeButtons[0]);
    fireEvent.click(closeButtons[1]);
    expect(onClose).toHaveBeenCalledTimes(2);
  });

  it("renders normalized product details and closes", () => {
    const onClose = vi.fn();
    render(<ProductDialog onClose={onClose} formatPrice={(price) => `Rs. ${price}`} product={{ id: "p1", name: "Rose Box", imageUrl: "/rose.png", category: "Flowers", price: 5000, currency: "LKR", stock: 1, stockLabel: "In stock", eta: "Tomorrow", description: "Lovely gift. Incomplete...", url: "#" }} />);
    expect(screen.getByRole("dialog", { name: "Rose Box" })).toBeInTheDocument();
    expect(screen.getByText("Lovely gift.")).toBeInTheDocument();
    expect(screen.getByText("Rs. 5000")).toBeInTheDocument();
    fireEvent.click(screen.getAllByRole("button", { name: "Close product details" })[0]);
    expect(onClose).toHaveBeenCalledOnce();
  });
});
